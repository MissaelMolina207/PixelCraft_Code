// lib/cloudflare.js — Cliente mínimo de Cloudflare Workers AI (FLUX.1 [schnell]). Sin SDK, sin dependencias.
// Cuota gratuita: 10,000 "neuronas" al día (se reinicia a las 00:00 UTC). Al agotarse responde 429 (código 3036): no cobra.

const BASE = 'https://api.cloudflare.com/client/v4/accounts';
const MODEL = '@cf/black-forest-labs/flux-1-schnell';

export class CloudflareError extends Error {
  constructor(message, status, detail, code) {
    super(message);
    this.status = status;  // HTTP (401/403 auth o plan, 429 cuota diaria, 408/504 timeout…)
    this.detail = detail;  // solo para logs
    this.code = code;      // código interno de Cloudflare (3036 = cuota agotada, 5035 = requiere plan de pago…)
  }
}

const clean = v => (v || '').trim().replace(/^["']+|["']+$/g, '').trim();

/** Credenciales saneadas, o null si falta alguna. */
export function getCreds() {
  const accountId = clean(process.env.CLOUDFLARE_ACCOUNT_ID);
  const token = clean(process.env.CLOUDFLARE_API_TOKEN);
  return accountId && token ? { accountId, token } : null;
}

/**
 * Texto → imagen con FLUX.1 [schnell]. Devuelve un data URL listo para <img> / canvas.
 * steps: 4 es el diseño del modelo (máx. 8; más pasos = más latencia y más neuronas, no más calidad).
 */
export async function runFlux(prompt, { accountId, token }, { steps = 4, timeoutMs = 50_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}/${accountId}/ai/run/${MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps }), // el modelo admite hasta 2048 caracteres
      signal: ctrl.signal
    });

    // Por REST llega como JSON { result: { image: base64 }, success }. Por si acaso, también aceptamos binario.
    if ((r.headers.get('content-type') || '').startsWith('image/')) {
      const buf = Buffer.from(await r.arrayBuffer());
      return `data:${r.headers.get('content-type').split(';')[0]};base64,${buf.toString('base64')}`;
    }

    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.success === false) {
      const e = data.errors?.[0] || {};
      throw new CloudflareError(e.message || 'Cloudflare rechazó la petición', r.status, `${e.code ?? ''} ${e.message ?? ''}`.trim(), e.code);
    }
    const b64 = data.result?.image ?? data.image;
    if (typeof b64 !== 'string' || !b64) throw new CloudflareError('Cloudflare no devolvió una imagen', 502, JSON.stringify(data).slice(0, 300));
    return `data:image/jpeg;base64,${b64}`;
  } catch (err) {
    if (err.name === 'AbortError') throw new CloudflareError('Tiempo agotado esperando a Cloudflare', 504);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
