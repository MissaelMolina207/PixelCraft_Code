// lib/admin/http.js — Errores HTTP con mensaje listo para mostrar. Los handlers lanzan, api/admin.js responde.
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
export const bad = msg => new HttpError(400, msg);
export const notFound = (msg = 'No encontrado') => new HttpError(404, msg);
export const conflict = msg => new HttpError(409, msg);

/** Parsea un JSON guardado en TEXT sin explotar si está corrupto. */
export const parseJSON = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };

/** Entero positivo o 0. */
export const int = v => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : 0; };
