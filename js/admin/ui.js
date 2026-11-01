// js/admin/ui.js — Piezas de interfaz compartidas por todas las vistas. Texto siempre con textContent (nunca innerHTML).

export const $ = (s, r = document) => r.querySelector(s);

export const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'value') n.value = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid);
  return n;
};

/** Etapas del taller. `short` = columna del tablero; `label` = selector del formulario. El cliente ve otros textos (lib/orders.js). */
export const STAGES = [
  { key: 'quote', label: 'Cotización (sin anticipo todavía)', short: 'Cotizada' },
  { key: 'approved', label: 'Aprobada · por asignar', short: 'Por asignar' },
  { key: 'production', label: 'En taller / con proveedor', short: 'En taller' },
  { key: 'quality', label: 'Control de calidad y empaque', short: 'Control de calidad' },
  { key: 'shipping', label: 'Enviada · en camino con paquetería', short: 'Enviado' },
  { key: 'delivered', label: 'Entregada', short: 'Entregada' }
];
export const stageLabel = k => STAGES.find(s => s.key === k)?.short || k;

export const money = n => {
  const v = Number(n) || 0;
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 });
};
export const pct = n => `${Number(n) || 0}%`;

/** '2026-10-29' → '29 oct'. */
export function fdate(s) {
  if (!s) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

let timer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => t.classList.remove('show'), 3000);
}

/** <label> con título + control. */
export const field = (label, control, cls = '') => el('label', { class: `fld ${cls}`.trim() }, el('span', {}, label), control);

export const select = (options, value = '', props = {}) =>
  el('select', props, options.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return el('option', { value: v, selected: v === value }, t); }));

const stack = []; // pila de modales: una confirmación encima de un formulario NO destruye el formulario
document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) stack.at(-1).close(); });

/**
 * Modal accesible y apilable. Esc (solo el de arriba) y clic fuera lo cierran. Devuelve { body, close }.
 * El foco va al primer campo; al cerrar vuelve a donde estaba. opts.onClose se ejecuta SIEMPRE al cerrar.
 */
export function modal(title, { wide = false, onClose } = {}) {
  const prev = document.activeElement;
  const body = el('div', { class: 'adm-modal-body' });
  const entry = {};
  const overlay = el('div', { class: 'adm-overlay' },
    el('div', { class: `adm-dialog${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('div', { class: 'adm-dialog-head' }, el('h2', {}, title), el('button', { class: 'adm-x', type: 'button', 'aria-label': 'Cerrar', onclick: () => entry.close() }, '✕')),
      body));
  entry.close = () => {
    const i = stack.indexOf(entry);
    if (i < 0) return;
    stack.splice(i, 1);
    overlay.remove();
    prev?.focus?.();
    onClose?.();
  };
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) entry.close(); });
  stack.push(entry);
  $('#modal').append(overlay);
  queueMicrotask(() => body.querySelector('input, select, textarea, button')?.focus());
  return { body, close: entry.close };
}

/** Confirmación propia (los confirm() nativos se bloquean y se ven mal). Devuelve Promise<boolean>. */
export function confirmBox(message, { ok = 'Confirmar', danger = false } = {}) {
  return new Promise(resolve => {
    const m = modal('Confirmar', { onClose: () => resolve(false) }); // Esc / clic fuera = cancelar
    m.body.append(el('p', {}, message), el('div', { class: 'adm-actions' },
      el('button', { class: 'btn', type: 'button', onclick: () => m.close() }, 'Cancelar'),
      el('button', { class: `btn ${danger ? 'danger' : 'red'}`, type: 'button', onclick: () => { resolve(true); m.close(); } }, ok)));
  });
}

export const badge = (text, cls = '') => el('span', { class: `adm-badge ${cls}`.trim() }, text);

// ---------- Canales de venta ----------
export const MARKETPLACES = ['Mercado Libre', 'Amazon', 'Facebook Marketplace'];
export const CHANNELS = ['WhatsApp', 'Estudio IA', 'Web', 'Presencial', ...MARKETPLACES, 'Otro'];
export const isMarketplace = c => MARKETPLACES.includes(c);
const CH = { 'Mercado Libre': ['ch-ml', 'ML'], Amazon: ['ch-amz', 'AMZ'], 'Facebook Marketplace': ['ch-fb', 'FB'], WhatsApp: ['ch-own', 'WA'], Web: ['ch-own', 'WEB'], 'Estudio IA': ['ch-own', 'IA'] };
export const channelClass = c => (CH[c] || ['ch-own'])[0];
/** Insignia de canal: color + sigla. Es lo que distingue de un vistazo tienda propia vs marketplace. */
export const channelBadge = c => el('span', { class: `adm-ch ${channelClass(c)}` }, el('b', {}, (CH[c] || [, '•'])[1]), c);
