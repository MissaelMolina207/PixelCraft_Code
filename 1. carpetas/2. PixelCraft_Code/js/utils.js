export const $ = (s, r = document) => r.querySelector(s);
export const fmt = n => '$' + n.toLocaleString('es-MX') + ' MXN';
export const wa = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

let timer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(timer); timer = setTimeout(() => t.classList.remove('show'), 2800);
}

export async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url);
  return r.json();
}

// POST JSON. Si falla, el error trae .status (undefined = sin red / sin servidor).
export async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || r.statusText), { status: r.status });
  return data;
}
