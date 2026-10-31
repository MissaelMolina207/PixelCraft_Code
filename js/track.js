// js/track.js — Rastreo público. Folio + últimos 4 dígitos → /api/track → timeline.
// Todo texto del servidor entra con textContent (nunca innerHTML).
import { $, getJSON, wa, toast } from './utils.js';

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid);
  return n;
};

/** '2026-10-29' o ISO completo → "29 de octubre". Las fechas sin hora se leen como locales (sin brincar un día por UTC). */
function fmtDate(s) {
  if (!s) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
}

const form = $('#trackForm'), out = $('#trackResult'), err = $('#trackError'), btn = $('#trackBtn');
let whatsapp = '';
getJSON('data/site.json').then(s => { whatsapp = s.whatsapp; }).catch(() => {});

function showError(msg) { err.textContent = msg; err.hidden = false; out.hidden = true; }

function statusBanner(o) {
  if (o.delivered) return el('div', { class: 'track-status done' }, el('strong', {}, '¡Pedido entregado!'), el('small', {}, o.deliveredAt ? `Entregado el ${fmtDate(o.deliveredAt)}. Gracias por confiar en PixelCraft.` : 'Gracias por confiar en PixelCraft.'));
  if (o.stage === 'shipping') return el('div', { class: 'track-status' }, el('strong', {}, 'Tu pedido va en camino'), el('small', {}, o.shipping?.eta ? `Llegada estimada: ${fmtDate(o.shipping.eta)}` : 'Usa la guía para ver el avance con la paquetería.'));
  const cur = o.steps.find(s => s.state === 'current');
  return el('div', { class: 'track-status' }, el('strong', {}, cur ? cur.label : 'En proceso'), el('small', {}, o.dueDate ? `Fecha estimada de entrega: ${fmtDate(o.dueDate)}` : 'Te avisaremos cuando avance a la siguiente etapa.'));
}

function render(o) {
  const help = whatsapp ? el('a', { class: 'btn', target: '_blank', rel: 'noopener', href: wa(whatsapp, `Hola PixelCraft, tengo una duda sobre mi pedido ${o.folio}.`) }, 'Escríbenos por WhatsApp') : null;
  const ship = o.shipping && el('div', { class: 'track-card track-ship' },
    el('h2', {}, 'Envío'),
    el('dl', {}, o.shipping.carrier ? [el('dt', {}, 'Paquetería'), el('dd', {}, o.shipping.carrier)] : null,
      o.shipping.guide ? [el('dt', {}, 'Guía'), el('dd', {}, o.shipping.guide)] : null,
      o.shipping.eta ? [el('dt', {}, 'Llegada estimada'), el('dd', {}, fmtDate(o.shipping.eta))] : null),
    el('div', { class: 'row' },
      o.shipping.url ? el('a', { class: 'btn red', href: o.shipping.url, target: '_blank', rel: 'noopener noreferrer' }, `Rastrear con ${o.shipping.carrier || 'la paquetería'}`) : null,
      o.shipping.guide ? el('button', { class: 'btn', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(o.shipping.guide); toast('Guía copiada'); } catch { toast(`Guía: ${o.shipping.guide}`); } } }, 'Copiar guía') : null));

  out.replaceChildren(
    el('div', { class: 'track-card' },
      el('span', { class: 'track-folio' }, o.folio),
      el('h2', {}, o.title),
      o.customer ? el('small', { style: 'color: var(--soft)' }, `Hola, ${o.customer}. Esto es lo que llevamos de tu pedido.`) : null,
      o.items.length ? el('ul', { class: 'track-items' }, o.items.map(i => el('li', {}, el('span', {}, el('b', {}, i.name), i.specs ? ` · ${i.specs}` : ''), el('span', {}, `× ${i.qty}`)))) : null),
    statusBanner(o),
    el('ol', { class: 'track-steps' }, o.steps.map(s => el('li', { class: `track-step ${s.state}`, 'aria-current': s.state === 'current' ? 'step' : false },
      el('span', { class: 'track-dot', 'aria-hidden': 'true' }, s.state === 'done' ? '✓' : s.state === 'current' ? '●' : ''),
      el('div', {}, el('h3', {}, s.label), el('p', {}, s.hint), s.at ? el('time', { datetime: s.at }, fmtDate(s.at)) : null)))),
    ship,
    o.publicNote ? el('p', { class: 'track-note' }, o.publicNote) : null,
    help ? el('div', { class: 'row' }, help) : null);
  err.hidden = true;
  out.hidden = false;
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const folio = $('#folio').value.trim().toUpperCase();
  const tel = $('#tel').value.replace(/\D/g, '');
  btn.disabled = true;
  btn.textContent = 'Buscando…';
  try {
    const r = await fetch(`/api/track?folio=${encodeURIComponent(folio)}&tel=${encodeURIComponent(tel)}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return showError(data.error || (r.status === 404 ? 'El rastreo solo funciona en el sitio publicado.' : 'No pudimos consultar tu pedido.'));
    render(data);
  } catch {
    showError('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ver mi pedido';
  }
});

// Enlace directo: rastreo.html?folio=PC-1001 (el teléfono NUNCA va en la URL)
const pre = new URLSearchParams(location.search).get('folio');
if (pre) { $('#folio').value = pre.toUpperCase().slice(0, 20); $('#tel').focus(); }
