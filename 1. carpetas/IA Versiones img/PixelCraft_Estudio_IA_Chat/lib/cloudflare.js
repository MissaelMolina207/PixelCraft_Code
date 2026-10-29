// lib/cloudflare.js — Cloudflare Workers AI. Un solo proveedor, tres usos (todos dentro de la cuota gratis de 10,000 neuronas/día):
//   runKlein → FLUX.2 [klein] 4B: texto→imagen Y edición con imágenes de referencia (≈104 neuronas por 1024², ≈90 diseños/día)
//   runFlux  → FLUX.1 [schnell]: texto→imagen básico (≈58 neuronas, ≈170/día). Plan B si klein no está disponible en tu plan.
//   runLLM   → LLM chico para traducir y mejorar el prompt del cliente (≈10 neuronas por turno)
// Cuando se agota la cuota responde 429 (código 3036): no cobra.

const BASE = 'https://api.cloudflare.com/client/v4/accounts';

export const MODELS = {
  klein: '@cf/black-forest-labs/flux-2-klein-4b',
  schnell: '@cf/black-forest-labs/flux-1-schnell',
  llm: '@cf/meta/llama-3.1-8b-instruct-fp8-fast'
};

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

/** data URL → Blob (para multipart). */
export function dataUrlToBlob(dataUrl) {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new CloudflareError('Imagen de referencia inválida', 400);
  return new Blob([Buffer.from(m[2], 'base64')], { type: m[1] });
}

/** POST a /ai/run/{modelo}. Devuelve el `result` de Cloudflare. Un solo lugar para errores, timeouts y auth. */
async function run(model, { accountId, token }, body, { headers = {}, timeoutMs = 50_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}/${accountId}/ai/run/${model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, ...headers },
      body,
      signal: ctrl.signal
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.success === false) {
      const e = data.errors?.[0] || {};
      throw new CloudflareError(e.message || 'Cloudflare rechazó la petición', r.status, `${e.code ?? ''} ${e.message ?? ''}`.trim(), e.code);
    }
    return data.result ?? data;
  } catch (err) {
    if (err.name === 'AbortError') throw new CloudflareError('Tiempo agotado esperando a Cloudflare', 504);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const toDataUrl = b64 => {
  if (typeof b64 !== 'string' || !b64) throw new CloudflareError('Cloudflare no devolvió una imagen', 502);
  return `data:image/jpeg;base64,${b64}`;
};

/**
 * FLUX.2 [klein] 4B. Siempre multipart (aunque solo lleve texto). Hasta 4 imágenes de referencia
 * (input_image_0…3), cada una de ≤ 512 px. En el prompt se referencian como "image 0", "image 1".
 */
export async function runKlein(prompt, creds, { images = [], width = 1024, height = 1024 } = {}) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', String(width));
  form.append('height', String(height));
  images.slice(0, 4).forEach((img, i) => form.append(`input_image_${i}`, dataUrlToBlob(img), `ref${i}.png`));
  // Sin Content-Type manual: fetch añade el boundary del multipart.
  const out = await run(MODELS.klein, creds, form);
  return toDataUrl(out.image);
}

/** FLUX.1 [schnell]: solo texto. steps=4 es lo que el modelo espera (máx. 8; más pasos = más neuronas, no más calidad). */
export async function runFlux(prompt, creds, { steps = 4 } = {}) {
  const out = await run(MODELS.schnell, creds, JSON.stringify({ prompt: prompt.slice(0, 2048), steps }), {
    headers: { 'Content-Type': 'application/json' }
  });
  return toDataUrl(out.image);
}

/** LLM de texto. Devuelve el string de la respuesta (soporta formato nativo y estilo OpenAI). */
export async function runLLM(messages, creds, { model = process.env.CF_LLM_MODEL || MODELS.llm, maxTokens = 450, temperature = 0.4 } = {}) {
  const out = await run(model, creds, JSON.stringify({ messages, max_tokens: maxTokens, temperature }), {
    headers: { 'Content-Type': 'application/json' },
    timeoutMs: 20_000
  });
  const text = out.response ?? out.choices?.[0]?.message?.content ?? '';
  return typeof text === 'string' ? text : JSON.stringify(text);
}
