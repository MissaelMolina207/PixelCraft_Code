// POST /api/generate — un turno del chat del Estudio IA.
//   { prompt, images?: [dataURL ≤2], prev?: brief anterior, quality?: 'draft'|'hd', rerender?: bool }
//   1) refine  → LLM (Cloudflare, gratis) convierte el mensaje del cliente en un brief {producto, color, arte}
//   2) buildPrompt → plantilla fija del taller (fondo gris, encuadre, luz)
//   3) render  → borrador gratis (Cloudflare FLUX.2 klein) o Render HD de pago (Gemini / Replicate)
//   ← { reply, spec, promptEn, engine, quality, image | imageUrl }
// GET  /api/generate          → capacidades (el frontend decide qué botones mostrar). Sin llamadas externas.
// GET  /api/generate?check=1  → diagnóstico de credenciales.
import { getToken, runModel, authCheck, toDataUrl, ReplicateError } from '../lib/replicate.js';
import { getCreds as getCfCreds, runKlein, runFlux, CloudflareError } from '../lib/cloudflare.js';
import { getKey as getGeminiKey, runGemini, GeminiError } from '../lib/gemini.js';
import { refine } from '../lib/refine.js';
import { buildPrompt, PRODUCTS } from '../lib/prompts.js';

const REPLICATE_MODELS = {
  text: process.env.REPLICATE_MODEL_TEXT || 'black-forest-labs/flux-schnell',
  edit: process.env.REPLICATE_MODEL_FUSION || 'google/nano-banana'
};

const MAX_PROMPT = 300;
const MAX_IMAGES = 2;
const MAX_IMAGE_CHARS = 341_000; // ≈ 256 KB en binario por imagen
const IMAGE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const FREE_PER_DAY = 80; // referencia para la UI: 10,000 neuronas ÷ ~125 por turno (LLM + FLUX.2 klein 1024²)

// ---------- Motores disponibles (según las variables de entorno de este deploy) ----------
/** Borrador: gratis primero. IMAGE_PROVIDER=cloudflare|google|replicate lo fuerza. */
function draftEngine() {
  const forced = (process.env.IMAGE_PROVIDER || '').trim().toLowerCase();
  if (forced === 'cloudflare') return getCfCreds() ? 'cloudflare' : null;
  if (forced === 'google') return getGeminiKey() ? 'google' : null;
  if (forced === 'replicate') return getToken() ? 'replicate' : null;
  if (getCfCreds()) return 'cloudflare';
  if (getGeminiKey()) return 'google';
  if (getToken()) return 'replicate';
  return null;
}
/** Render HD (de pago). PREMIUM_PROVIDER=google|replicate lo fuerza. Gemini es la misma familia que tus pruebas. */
function premiumEngine() {
  const forced = (process.env.PREMIUM_PROVIDER || '').trim().toLowerCase();
  if (forced === 'google') return getGeminiKey() ? 'google' : null;
  if (forced === 'replicate') return getToken() ? 'replicate' : null;
  if (getGeminiKey()) return 'google';
  if (getToken()) return 'replicate';
  return null;
}
const cfModel = () => ((process.env.CF_IMAGE_MODEL || 'klein').toLowerCase() === 'schnell' ? 'schnell' : 'klein');
/** ¿Este motor acepta imágenes de referencia? */
const editsImages = engine => !(engine === 'cloudflare' && cfModel() === 'schnell');

// ---------- Defensas baratas (cada llamada gasta cuota o dinero real) ----------
const hits = new Map();
/** Rate limit en memoria de la instancia: frena al curioso, no al atacante. Blindaje real: Vercel Firewall. */
function limited(key, max, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 800) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
  return recent.length > max;
}
/** Tope global diario de renders HD (por instancia). HD_DAILY_CAP=0 lo desactiva por completo. */
const hd = { day: '', n: 0 };
function hdBudgetLeft() {
  const cap = Number(process.env.HD_DAILY_CAP ?? 30);
  const today = new Date().toISOString().slice(0, 10);
  if (hd.day !== today) { hd.day = today; hd.n = 0; }
  return hd.n < cap;
}

/** Bloquea peticiones de navegador desde otros orígenes. */
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}

const fail = (res, code, error, extra = {}) => res.status(code).json({ error, ...extra });
class ConfigError extends Error {}

// ---------- Render ----------
async function render(engine, prompt, images) {
  switch (engine) {
    case 'cloudflare': {
      const creds = getCfCreds();
      if (!creds) throw new ConfigError('Cloudflare sin credenciales');
      return { image: cfModel() === 'schnell' ? await runFlux(prompt, creds) : await runKlein(prompt, creds, { images }) };
    }
    case 'google': {
      const key = getGeminiKey();
      if (!key) throw new ConfigError('GEMINI_API_KEY ausente');
      return { image: await runGemini(prompt, key, { images }) };
    }
    case 'replicate': {
      const token = getToken();
      if (!token) throw new ConfigError('REPLICATE_API_TOKEN ausente');
      const url = images.length
        ? await runModel(REPLICATE_MODELS.edit, { prompt, image_input: images, aspect_ratio: '1:1', output_format: 'jpg' }, { token })
        : await runModel(REPLICATE_MODELS.text, { prompt, num_outputs: 1, aspect_ratio: '1:1', output_format: 'webp', output_quality: 90 }, { token });
      const dataUrl = await toDataUrl(url);
      return dataUrl ? { image: dataUrl } : { imageUrl: url };
    }
    default:
      throw new ConfigError('Ningún motor de imágenes configurado');
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const ip = req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';

  // --- GET: capacidades y diagnóstico ---
  if (req.method === 'GET') {
    if (limited(`get:${ip}`, 30)) return fail(res, 429, 'Demasiadas consultas');
    const engine = draftEngine();
    const premium = premiumEngine();
    const caps = {
      engine,
      ready: !!engine,
      refs: !!engine && editsImages(engine),  // ¿acepta imágenes del cliente?
      llm: !!getCfCreds(),                    // ¿mejora de prompts con IA? (si no, plan B por regex)
      hd: !!premium && Number(process.env.HD_DAILY_CAP ?? 30) > 0,
      freePerDay: engine === 'cloudflare' ? FREE_PER_DAY : null
    };
    if (new URL(req.url || '/', 'http://x').searchParams.get('check') !== '1') return res.status(200).json(caps);

    const rep = getToken();
    const status = rep ? await authCheck(rep).catch(() => 0) : null;
    return res.status(200).json({
      ...caps,
      premium,
      cloudflare: { configured: !!getCfCreds(), imageModel: cfModel() },
      google: { configured: !!getGeminiKey() },
      replicate: { configured: !!rep, formatOk: rep.startsWith('r8_'), auth: status === 200 ? 'ok' : status === null ? 'sin token' : `rechazado (HTTP ${status})` }
    });
  }

  if (req.method !== 'POST') return fail(res, 405, 'Método no permitido');
  if (!sameOrigin(req)) return fail(res, 403, 'Origen no permitido');
  if (limited(`post:${ip}`, 8)) return fail(res, 429, 'Vas muy rápido. Espera un minuto y vuelve a intentar.');
  if (limited(`day:${ip}`, 60, 86_400_000)) return fail(res, 429, 'Llegaste al límite de diseños de hoy. Vuelve mañana o cotiza por WhatsApp.', { code: 'quota' });

  // --- Entrada ---
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const quality = body?.quality === 'hd' ? 'hd' : 'draft';
  const rerender = body?.rerender === true && quality === 'hd';
  const images = Array.isArray(body?.images) ? body.images.slice(0, MAX_IMAGES) : [];
  const prompt = String(body?.prompt ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT)
    || (images.length ? 'Usa mi arte tal cual' : '');
  const prev = body?.prev && typeof body.prev === 'object' ? body.prev : null;

  if (!rerender && prompt.length < 2) return fail(res, 400, 'Cuéntame tu idea para empezar.');
  if (images.some(i => !(typeof i === 'string' && i.length <= MAX_IMAGE_CHARS && IMAGE_RE.test(i)))) {
    return fail(res, 400, 'Una de las imágenes no es válida (PNG, JPG o WebP, ligera).');
  }
  if (rerender && !prev?.artwork) return fail(res, 400, 'No hay diseño previo para renderizar en HD.');

  try {
    // --- Motor ---
    let engine;
    if (quality === 'hd') {
      engine = premiumEngine();
      if (!engine || !hdBudgetLeft() || limited(`hd:${ip}`, 4, 3_600_000)) {
        return fail(res, 429, 'El Render HD no está disponible ahora. Cotiza tu diseño y lo afinamos nosotros.', { code: 'hd_unavailable' });
      }
    } else {
      engine = draftEngine();
      if (!engine) throw new ConfigError('Ningún motor de imágenes configurado');
    }
    const refs = editsImages(engine) ? images : [];

    // --- 1) Brief (gratis). En HD sobre un diseño existente se reutiliza el brief: cero LLM, cero sorpresas ---
    const spec = rerender
      ? { allowed: true, reply: 'Aquí está tu render en alta calidad.', product: prev.product, color: prev.color, artwork: prev.artwork, summary: prev.summary || '' }
      : (await refine({ text: prompt, hasImages: images.length > 0, prev, creds: getCfCreds() })).spec;

    if (!spec.allowed) return fail(res, 422, spec.reply || 'Esa idea no la podemos generar. Prueba con otra.', { code: 'blocked' });

    // --- 2) Prompt final + 3) Render ---
    const promptEn = buildPrompt(spec, refs.length > 0);
    const out = await render(engine, promptEn, refs);
    if (quality === 'hd') hd.n++;

    return res.status(200).json({
      reply: spec.reply,
      spec: { product: spec.product, label: PRODUCTS[spec.product].label, color: spec.color, artwork: spec.artwork, summary: spec.summary },
      promptEn, engine, quality, usedRefs: refs.length, ...out
    });
  } catch (err) {
    console.error('[generate]', err.constructor.name, err.status ?? '', err.code ?? '', err.message, err.detail ?? '');

    if (err instanceof ConfigError) {
      return fail(res, 503, 'El motor de IA no está disponible por ahora. Cotiza por WhatsApp.', { code: 'config' });
    }
    if (err instanceof ReplicateError || err instanceof CloudflareError || err instanceof GeminiError) {
      if (/nsfw|safety|sensitive|flagged|blocked|prohibited/i.test(String(err.detail))) {
        return fail(res, 422, 'El motor rechazó esa descripción. Prueba con otra idea.', { code: 'blocked' });
      }
      // 3036 = cuota diaria gratuita de Cloudflare agotada
      if (err.status === 429 || err.code === 3036) return fail(res, 429, 'El motor llegó a su límite por ahora. Intenta más tarde o cotiza por WhatsApp.', { code: 'quota' });
      if (err.status === 401 || err.status === 402 || err.status === 403 || (err.status === 400 && /api key/i.test(String(err.detail)))) {
        return fail(res, 503, 'El motor de IA no está disponible por ahora. Cotiza por WhatsApp.', { code: 'auth' });
      }
      if (err.status === 408 || err.status === 504) return fail(res, 504, 'Tardó demasiado. Intenta de nuevo.');
    }
    return fail(res, 502, 'No se pudo generar el diseño. Intenta de nuevo.');
  }
}
