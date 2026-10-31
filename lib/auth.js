// lib/auth.js — Sesión del panel admin. Una contraseña (ADMIN_PASSWORD) → cookie firmada con HMAC-SHA256.
// Defensas: comparación en tiempo constante, cookie HttpOnly + SameSite=Strict + Path=/api, caducidad de 8 h,
// y cabecera obligatoria X-Requested-With en toda escritura (CSRF). El HTML del admin es público y no contiene secretos.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'pc_admin';
const TTL_S = 8 * 3600;
const sha = s => createHash('sha256').update(String(s)).digest();
const eq = (a, b) => a.length === b.length && timingSafeEqual(a, b);

export const authConfigured = () => (process.env.ADMIN_PASSWORD || '').length >= 10;

/** ADMIN_SECRET aparte es lo ideal; si no existe se deriva de la contraseña (cambiarla invalida las sesiones). */
const secret = () => process.env.ADMIN_SECRET || sha(`pc-session|${process.env.ADMIN_PASSWORD || ''}`).toString('hex');
const mac = payload => createHmac('sha256', secret()).update(payload).digest('base64url');

export function checkPassword(input) {
  if (!authConfigured()) return false;
  return eq(sha(input), sha(process.env.ADMIN_PASSWORD));
}

const isLocal = req => /^(localhost|127\.0\.0\.1)(:|$)/.test(req.headers.host || '');

export function sessionCookie(req) {
  const exp = Math.floor(Date.now() / 1000) + TTL_S;
  const token = `${exp}.${mac(String(exp))}`;
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${TTL_S}${isLocal(req) ? '' : '; Secure'}`;
}
export const clearCookie = req => `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${isLocal(req) ? '' : '; Secure'}`;

export function isAuthed(req) {
  if (!authConfigured()) return false;
  const raw = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return eq(Buffer.from(sig), Buffer.from(mac(exp)));
}

/** Escrituras: cabecera custom (un <form> de otro sitio no puede ponerla) + mismo origen si el navegador manda Origin. */
export function csrfOk(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  if (req.headers['x-requested-with'] !== 'pc-admin') return false;
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}
