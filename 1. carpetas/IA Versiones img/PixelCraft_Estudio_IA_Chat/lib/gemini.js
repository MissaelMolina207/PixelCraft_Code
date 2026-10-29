// lib/gemini.js — Gemini API (Nano Banana): motor premium "Render HD". Sin SDK.
// Precio oficial (ai.google.dev, oct-2026): gemini-nano-banana-2.1 ≈ US$0.0336 por imagen de 1K. No tiene capa gratuita en la API.

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-nano-banana-2.1';

export class GeminiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

/** API key saneada (AI Studio → Get API key), o '' si no hay. */
export const getKey = () => (process.env.GEMINI_API_KEY || '').trim().replace(/^["']+|["']+$/g, '').trim();

/**
 * Texto (+ imágenes de referencia) → imagen 1K cuadrada. Devuelve un data URL.
 * Contrato: un part de texto con la instrucción + un part inlineData por imagen (nunca mezclados en el mismo part).
 */
export async function runGemini(prompt, key, { images = [], model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL, timeoutMs = 55_000 } = {}) {
  const parts = [{ text: prompt }];
  for (const img of images.slice(0, 4)) {
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(img || '');
    if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1', imageSize: '1K' } }
      }),
      signal: ctrl.signal
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = data.error || {};
      throw new GeminiError(e.message || 'Gemini rechazó la petición', r.status, `${e.status ?? ''} ${e.message ?? ''}`.trim());
    }
    const cand = data.candidates?.[0];
    const img = cand?.content?.parts?.find(p => p.inlineData?.data)?.inlineData;
    if (!img) {
      // Sin imagen casi siempre = bloqueo de seguridad. Dejamos la razón en el detalle (para logs y para el filtro del handler).
      const why = data.promptFeedback?.blockReason || cand?.finishReason || 'sin imagen';
      throw new GeminiError('Gemini no devolvió una imagen', 502, `blocked ${why}`);
    }
    return `data:${img.mimeType || 'image/png'};base64,${img.data}`;
  } catch (err) {
    if (err.name === 'AbortError') throw new GeminiError('Tiempo agotado esperando a Gemini', 504);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
