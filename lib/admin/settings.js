// lib/admin/settings.js — Configuración guardada del panel (valores por defecto de las calculadoras). Whitelist estricta.
import { first, run } from '../db.js';
import { DEFAULTS } from '../calc.js';
import { bad, parseJSON } from './http.js';

const KEYS = { calc: DEFAULTS };

/** Mezcla lo guardado con los defaults: si falta una llave (versión nueva), cae al default. */
export async function settingsHandler({ method, query, body }) {
  const key = query.get('key') || '';
  if (!KEYS[key]) throw bad('Configuración desconocida');
  if (method === 'GET') {
    const row = await first('SELECT v FROM settings WHERE k = ?', [key]);
    const saved = parseJSON(row?.v, {});
    const out = {};
    for (const [group, defs] of Object.entries(KEYS[key])) out[group] = { ...defs, ...(saved[group] || {}) };
    return { value: out, defaults: KEYS[key] };
  }
  if (method === 'PUT') {
    const clean = {};
    for (const [group, defs] of Object.entries(KEYS[key])) {
      clean[group] = {};
      for (const [k, def] of Object.entries(defs)) {
        const v = body?.value?.[group]?.[k];
        if (typeof def === 'number') {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0 || n > 1e7) throw bad(`Valor no válido: ${group}.${k}`);
          clean[group][k] = n;
        } else {
          if (!['markup', 'price'].includes(v)) throw bad(`Valor no válido: ${group}.${k}`);
          clean[group][k] = v;
        }
      }
    }
    await run('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', [key, JSON.stringify(clean)]);
    return { ok: true };
  }
  throw bad('Método no permitido');
}
