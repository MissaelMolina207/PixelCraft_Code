// lib/refine.js — Paso 1 del chat: mensaje del cliente → brief. LLM de Cloudflare con Plan B por regex.
import { runLLM } from './cloudflare.js';
import { buildMessages, normalizeSpec, heuristicSpec } from './prompts.js';

/** Extrae el primer objeto JSON de una respuesta de LLM (tolera ```json …``` y texto alrededor). */
export function extractJson(text) {
  const m = /\{[\s\S]*\}/.exec(String(text || ''));
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

/**
 * @returns {{ spec: object, usedLLM: boolean }}
 * Nunca lanza: si el LLM falla (cuota, timeout, JSON roto) se usa el brief heurístico y el cliente ni se entera.
 */
export async function refine({ text, hasImages, prev, creds }) {
  if (creds) {
    try {
      const raw = await runLLM(buildMessages(text, { hasImages, prev }), creds);
      const json = extractJson(raw);
      if (json) return { spec: normalizeSpec(json, text, prev), usedLLM: true };
      console.error('[refine] el LLM no devolvió JSON:', String(raw).slice(0, 200));
    } catch (err) {
      console.error('[refine] LLM falló, uso plan B:', err.status ?? '', err.code ?? '', err.message);
    }
  }
  return { spec: heuristicSpec(text, prev), usedLLM: false };
}
