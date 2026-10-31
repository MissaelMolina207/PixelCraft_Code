// lib/limits.js — Rate limit en memoria de la instancia. Frena al curioso, no al atacante distribuido:
// para eso, una regla de Vercel Firewall. Sin dependencias.
const hits = new Map();

/** true si `key` superó `max` intentos dentro de `windowMs`. Cuenta este intento. */
export function limited(key, max, windowMs = 60_000) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 1000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
  return recent.length > max;
}

/** Cuenta SOLO los fallos: el login correcto no consume intentos. */
export function failures(key, windowMs = 15 * 60_000) {
  const now = Date.now();
  return (hits.get(key) || []).filter(t => now - t < windowMs).length;
}

export const clientIp = req =>
  req.headers['x-real-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'anon';
