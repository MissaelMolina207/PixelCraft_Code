// js/admin/api.js — Cliente del API privado. La cookie de sesión es HttpOnly: el JS nunca la ve ni la guarda.
// X-Requested-With es obligatorio en el servidor (anti-CSRF): un <form> de otro sitio no puede añadirla.

// "Época" de sesión: sube en cada login/logout. Un 401 que llega de una petición hecha en una época anterior
// (p. ej. una vista que cargaba mientras la sesión estaba muerta) NO debe tumbar la sesión nueva.
let epoch = 0;
export const newEpoch = () => ++epoch;

export async function api(resource, { method = 'GET', query = {}, body } = {}) {
  const started = epoch;
  const qs = new URLSearchParams({ r: resource, ...query });
  const res = await fetch(`/api/admin?${qs}`, {
    method,
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'pc-admin', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && resource !== 'login' && started === epoch) document.dispatchEvent(new CustomEvent('admin:expired'));
    throw Object.assign(new Error(data.error || res.statusText || 'Error'), { status: res.status, code: data.code });
  }
  return data;
}
