// POST /api/generate
//   { mode: 'text',   prompt }          → Flux Schnell: texto → playera con estampa (rápido y barato)
//   { mode: 'fusion', prompt?, image }  → nano-banana: tu arte (data URL) → playera gris con el arte en el pecho
// GET  /api/generate → diagnóstico del token (no gasta crédito, no revela secretos)
// Respuesta OK: { image } (data URL) o { imageUrl } si la imagen es demasiado pesada.
import { getToken, runModel, authCheck, toDataUrl, ReplicateError } from '../lib/replicate.js';

// Cambiables desde Vercel (Environment Variables) sin tocar código.
const MODELS = {
  text: process.env.REPLICATE_MODEL_TEXT || 'black-forest-labs/flux-schnell',
  fusion: process.env.REPLICATE_MODEL_FUSION || 'google/nano-banana'
};

const MAX_PROMPT = 300;
const MAX_IMAGE_CHARS = 341_000; // ≈ 256 KB en binario: el límite que Replicate recomienda para data URLs
const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

const SHIRT = 'a single plain white short-sleeve crew-neck t-shirt, front view, laid flat and centered, on a solid light grey studio background';

const textPrompt = p =>
  `Commercial product photo of ${SHIRT}. Soft even studio lighting, realistic cotton texture and natural fabric folds. ` +
  `A crisp screen-printed graphic is centered on the chest showing: ${p}. ` +
  `Photorealistic, sharp print, no model, no extra objects, no watermark.`;

const fusionPrompt = extra =>
  `Create a product mockup photo of ${SHIRT}. Print the provided image exactly as-is in the center of the chest: ` +
  `keep its characters, colors, text and proportions unchanged, drop its white background so only the artwork appears ` +
  `printed on the fabric, with realistic ink-on-cotton texture. Show only the t-shirt: no model, no extra objects.` +
  (extra ? ` Additional instructions: ${extra}` : '');

// ---- Defensas baratas (la API es pública y cada llamada cuesta dinero real) ----
const hits = new Map();
/** Rate limit en memoria de la instancia: frena al curioso, no al atacante. Blindaje real: Vercel Firewall. */
function limited(ip, max, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
  return recent.length > max;
}

/** Bloquea peticiones de navegador desde otros orígenes. Sin CORS abierto, otros sitios no pueden usar tu API. */
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}

const fail = (res, code, error, extra = {}) => res.status(code).json({ error, ...extra });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const ip = req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
  const token = getToken();

  // --- Diagnóstico: abre https://TU-DOMINIO/api/generate en el navegador ---
  if (req.method === 'GET') {
    if (limited(ip, 10)) return fail(res, 429, 'Demasiadas consultas');
    const status = token ? await authCheck(token).catch(() => 0) : null;
    return res.status(200).json({
      configured: !!token,
      formatOk: token.startsWith('r8_'),
      replicateAuth: status === 200 ? 'ok' : status === null ? 'sin token' : `rechazado (HTTP ${status})`
    });
  }

  if (req.method !== 'POST') return fail(res, 405, 'Método no permitido');
  if (!sameOrigin(req)) return fail(res, 403, 'Origen no permitido');
  if (limited(ip, 6)) return fail(res, 429, 'Vas muy rápido. Espera un minuto y vuelve a intentar.');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const mode = body?.mode === 'fusion' ? 'fusion' : 'text';
  const prompt = String(body?.prompt ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT);
  const image = body?.image;

  if (mode === 'text' && prompt.length < 3) return fail(res, 400, 'Escribe una idea válida para generar el diseño.');
  if (mode === 'fusion' && !(typeof image === 'string' && image.length <= MAX_IMAGE_CHARS && IMAGE_RE.test(image))) {
    return fail(res, 400, 'Sube un arte válido (PNG, JPG o WebP, ligero).');
  }
  if (!token) {
    console.error('[generate] REPLICATE_API_TOKEN vacío o ausente en este entorno');
    return fail(res, 503, 'El motor de IA no está disponible por ahora. Cotiza por WhatsApp.', { code: 'config' });
  }

  try {
    const input = mode === 'fusion'
      ? { prompt: fusionPrompt(prompt), image_input: [image], aspect_ratio: '1:1', output_format: 'jpg' }
      : { prompt: textPrompt(prompt), num_outputs: 1, aspect_ratio: '1:1', output_format: 'webp', output_quality: 90 };

    const url = await runModel(MODELS[mode], input, { token });
    const dataUrl = await toDataUrl(url);
    return res.status(200).json(dataUrl ? { image: dataUrl } : { imageUrl: url });
  } catch (err) {
    console.error('[generate]', mode, err.status, err.message, err.detail ?? '');
    if (err instanceof ReplicateError) {
      if (err.status === 401 || err.status === 402) {
        return fail(res, 503, 'El motor de IA no está disponible por ahora. Cotiza por WhatsApp.', { code: err.status === 401 ? 'auth' : 'billing' });
      }
      if (err.status === 429) return fail(res, 429, 'El motor está saturado. Intenta en un minuto.');
      if (err.status === 504) return fail(res, 504, 'Tardó demasiado. Intenta de nuevo.');
      if (/nsfw|safety|sensitive|flagged|blocked/i.test(String(err.detail))) {
        return fail(res, 422, 'El motor rechazó esa descripción. Prueba con otra idea.');
      }
    }
    return fail(res, 502, 'No se pudo generar el mockup. Intenta de nuevo.');
  }
}