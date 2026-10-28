// lib/replicate.js — Cliente mínimo de Replicate. Sin SDK: cero dependencias, arranque en frío corto.
// Vive en /lib (no en /api) para que Vercel NO lo exponga como endpoint público.

const API = 'https://api.replicate.com/v1';

export class ReplicateError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;   // HTTP de Replicate (401, 402, 422, 429…) o 504 si nos quedamos sin tiempo
    this.detail = detail;   // texto técnico: solo para logs, NUNCA para el usuario final
  }
}

/**
 * Lee y SANEA el token. Los 4 pecados clásicos al pegar variables en Vercel:
 * espacios/saltos de línea al final, comillas, o pegar "REPLICATE_API_TOKEN=r8_..." completo en el valor.
 */
export function getToken() {
  return (process.env.REPLICATE_API_TOKEN || '')
    .trim()
    .replace(/^REPLICATE_API_TOKEN\s*=\s*/i, '')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

const auth = token => ({ Authorization: `Bearer ${token}` }); // Replicate exige "Bearer" en su API actual

/** Verifica el token contra /account sin gastar crédito. Devuelve el HTTP status (200 = token vivo). */
export async function authCheck(token) {
  const r = await fetch(`${API}/account`, { headers: auth(token) });
  return r.status;
}

/**
 * Ejecuta un modelo OFICIAL (owner/name) y devuelve la URL de la imagen.
 * - Endpoint por modelo: sin hashes de versión que caducan.
 * - Prefer: wait → respuesta síncrona; si no alcanza, sondeo ACOTADO (el original era un while infinito).
 */
export async function runModel(model, input, { token, waitSeconds = 45, deadlineMs = 55_000 } = {}) {
  const t0 = Date.now();
  const r = await fetch(`${API}/models/${model}/predictions`, {
    method: 'POST',
    headers: { ...auth(token), 'Content-Type': 'application/json', Prefer: `wait=${waitSeconds}` },
    body: JSON.stringify({ input })
  });
  let data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ReplicateError(data.title || 'Replicate rechazó la petición', r.status, data.detail);

  while (!['succeeded', 'failed', 'canceled'].includes(data.status)) {
    if (Date.now() - t0 > deadlineMs) throw new ReplicateError('Tiempo agotado esperando a Replicate', 504);
    await new Promise(ok => setTimeout(ok, 1500));
    const p = await fetch(`${API}/predictions/${data.id}`, { headers: auth(token) });
    data = await p.json().catch(() => ({}));
    if (!p.ok) throw new ReplicateError('Error consultando la predicción', p.status, data.detail);
  }

  if (data.status !== 'succeeded') throw new ReplicateError('La generación no terminó', 502, data.error);

  // Flux devuelve array; nano-banana devuelve string. Normalizamos.
  const out = Array.isArray(data.output) ? data.output[0] : data.output;
  if (typeof out !== 'string') throw new ReplicateError('Replicate no devolvió una imagen', 502, JSON.stringify(data.output));
  return out;
}

/**
 * Descarga la imagen en el servidor y la entrega como data URL.
 * Mata dos pájaros: (1) cero CORS / canvas "tainted" en el navegador; (2) las URLs de replicate.delivery caducan.
 * Si pesa demasiado para el límite de 4.5 MB de respuesta de Vercel, devuelve null y se usa la URL directa.
 */
export async function toDataUrl(url, maxBytes = 3_200_000) {
  if (new URL(url).protocol !== 'https:') throw new ReplicateError('URL de salida no segura', 502);
  const r = await fetch(url);
  if (!r.ok) throw new ReplicateError('No se pudo descargar la imagen generada', 502);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > maxBytes) return null;
  const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  return `data:${mime};base64,${buf.toString('base64')}`;
}
