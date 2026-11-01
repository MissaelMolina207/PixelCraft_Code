// lib/orders.js — Reglas de negocio de las órdenes. PURO: sin red ni base de datos (se prueba solo).
import { readData } from './catalog.js';

/** Los 4 pasos que ve el cliente (estilo Mercado Libre). `delivered` es el cierre del paso 4. */
export const STAGES = [
  { key: 'approved', label: 'Cotización aprobada', hint: 'Tu diseño fue validado y confirmamos tu anticipo.' },
  { key: 'production', label: 'En producción con proveedor', hint: 'Tu pedido entró a línea de fabricación.' },
  { key: 'quality', label: 'Control de calidad y empaque', hint: 'Revisamos pieza por pieza y lo empacamos.' },
  { key: 'shipping', label: 'En camino con paquetería', hint: 'Tu paquete ya salió con la paquetería.' }
];
/** Pasos que ve el cliente. 'quote' (cotizada, sin anticipo) va ANTES y 'delivered' cierra el paso 4. */
const PUBLIC_KEYS = STAGES.map(s => s.key);
export const STAGE_KEYS = ['quote', ...PUBLIC_KEYS, 'delivered'];
export const TASK_STATUS = ['todo', 'doing', 'done'];
export const CUSTOMER_TYPES = ['Particular', 'Empresa', 'Agencia', 'Artista'];
export const MARKETPLACES = ['Mercado Libre', 'Amazon', 'Facebook Marketplace'];
export const CHANNELS = ['WhatsApp', 'Estudio IA', 'Web', 'Presencial', ...MARKETPLACES, 'Otro'];
export const isMarketplace = c => MARKETPLACES.includes(c);

/** Error de validación: el mensaje ya está en español y se muestra tal cual al usuario. */
export class ValidationError extends Error {}

const today = () => new Date().toISOString().slice(0, 10);
export const nowIso = () => new Date().toISOString();

// ---------- Validadores (devuelven el valor limpio o lanzan Error con mensaje en español) ----------
const text = (max, label) => v => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const oneOf = (list, label) => v => { if (!list.includes(v)) throw new ValidationError(`${label} no válido`); return v; };
const money = label => v => {
  const n = Number(v === '' || v == null ? 0 : v);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw new ValidationError(`${label} no válido`);
  return Math.round(n * 100) / 100;
};
const date = label => v => {
  const s = String(v ?? '').trim();
  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ValidationError(`${label} no válida (AAAA-MM-DD)`);
  return s;
};
const httpsUrl = label => v => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  let u; try { u = new URL(s); } catch { throw new ValidationError(`${label} no válido`); }
  if (u.protocol !== 'https:') throw new ValidationError(`${label} debe empezar con https://`);
  return s.slice(0, 400);
};
const items = v => {
  const list = Array.isArray(v) ? v : [];
  return JSON.stringify(list.slice(0, 30).map(i => ({
    name: text(100)(i?.name), qty: Math.max(1, Math.min(100000, parseInt(i?.qty, 10) || 1)), specs: text(200)(i?.specs),
    sku: /^[a-z0-9-]{1,40}$/.test(String(i?.sku ?? '')) ? i.sku : '' // id del producto del catálogo: enlaza la orden con el inventario
  })).filter(i => i.name));
};

/** Campo → validador. Es la whitelist: lo que no está aquí NUNCA llega a un UPDATE. */
const ORDER_FIELDS = {
  customer_name: text(80), phone: v => String(v ?? '').replace(/\D/g, '').slice(0, 15),
  customer_type: oneOf(CUSTOMER_TYPES, 'Tipo de cliente'), channel: oneOf(CHANNELS, 'Canal'),
  title: text(120), items, specs: text(1500), stage: oneOf(STAGE_KEYS, 'Etapa'),
  price: money('Precio'), cost: money('Costo'), paid: money('Pagado'), fee: money('Comisión del canal'), supplier: text(80),
  ext_ref: v => String(v ?? '').trim().replace(/[^A-Za-z0-9._#\-\/ ]/g, '').slice(0, 60),
  due_date: date('Fecha de entrega'), carrier: text(30),
  guide: v => String(v ?? '').trim().replace(/[^A-Za-z0-9-]/g, '').slice(0, 40),
  track_url: httpsUrl('Enlace de rastreo'), ship_eta: date('Fecha estimada de llegada'),
  notes: text(2000), public_note: text(300)
};
export const ORDER_COLUMNS = Object.keys(ORDER_FIELDS);

/**
 * Valida una orden. create=true exige lo mínimo y rellena defaults; create=false (PUT) acepta parciales.
 * @returns {{ data: object }} o lanza Error (mensaje listo para el usuario).
 */
export function cleanOrder(input, { create = false } = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const data = {};
  for (const [k, fn] of Object.entries(ORDER_FIELDS)) if (k in src) data[k] = fn(src[k]);
  if (create) {
    if ((data.customer_name || '').length < 2) throw new ValidationError('Falta el nombre del cliente');
    if ((data.title || '').length < 2) throw new ValidationError('Falta el resumen del pedido');
    // Las órdenes de marketplace no traen teléfono (Mercado Libre/Amazon lo ocultan): solo exigimos teléfono en canales propios.
    if (!isMarketplace(data.channel || 'WhatsApp') && (data.phone || '').length < 10) throw new ValidationError('El teléfono debe tener al menos 10 dígitos');
  }
  if ('customer_name' in data && data.customer_name.length < 2) throw new ValidationError('Falta el nombre del cliente');
  if (data.phone && data.phone.length < 10) throw new ValidationError('El teléfono debe tener al menos 10 dígitos');
  return { data };
}

/** Regla de teléfono sobre la orden YA fusionada (para PUT parciales). */
export function checkPhoneRule(row) {
  if (!isMarketplace(row.channel) && (row.phone || '').length < 10) throw new ValidationError('El teléfono debe tener al menos 10 dígitos');
}

/** Folio opcional escrito a mano: mayúsculas, dígitos y guion. */
export const cleanFolio = v => {
  const f = String(v ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(f)) throw new ValidationError('Folio no válido (letras, números y guion; 3-20 caracteres)');
  return f;
};

// ---------- Dinero ----------
export const round2 = n => Math.round(n * 100) / 100;
export function money_(o) {
  const margin = round2(o.price - o.cost - (o.fee || 0)); // utilidad real: descuenta la comisión del marketplace
  return { margin, marginPct: o.price > 0 ? round2((margin / o.price) * 100) : 0, balance: round2(o.price - o.paid) };
}

// ---------- Enlace de rastreo de la paquetería ----------
export function trackingUrl(o) {
  if (o.track_url) return o.track_url;
  if (!o.guide || !o.carrier) return '';
  try {
    const tpl = readData('carriers.json').carriers?.[o.carrier] || '';
    return tpl ? tpl.replace('{guide}', encodeURIComponent(o.guide)) : '';
  } catch { return ''; }
}

// ---------- Vista pública (lo ÚNICO que ve el cliente) ----------
export function timeline(stage, events = []) {
  const idx = PUBLIC_KEYS.indexOf(stage); // 'quote' → -1: ningún paso completado todavía
  const firstAt = key => events.find(e => e.stage === key)?.at || '';
  return STAGES.map((s, i) => ({
    key: s.key, label: s.label, hint: s.hint,
    state: stage === 'delivered' || idx > i ? 'done' : idx === i ? 'current' : 'todo',
    at: firstAt(s.key)
  }));
}

/** Whitelist explícita. Costos, márgenes, notas internas, ficha técnica y proveedor NO existen aquí. */
export function publicView(o, events = []) {
  let list = [];
  try { list = JSON.parse(o.items || '[]'); } catch { /* items corruptos: se muestran vacíos */ }
  const delivered = o.stage === 'delivered';
  return {
    folio: o.folio,
    stage: o.stage,
    quote: o.stage === 'quote',
    title: o.title,
    customer: (o.customer_name || '').split(' ')[0], // solo el primer nombre
    items: list.map(i => ({ name: i.name, qty: i.qty, specs: i.specs })), // el sku (interno) no sale
    steps: timeline(o.stage, events),
    delivered,
    deliveredAt: events.find(e => e.stage === 'delivered')?.at || '',
    dueDate: o.due_date,
    publicNote: o.public_note,
    shipping: ['shipping', 'delivered'].includes(o.stage) && (o.guide || o.carrier)
      ? { carrier: o.carrier, guide: o.guide, url: trackingUrl(o), eta: o.ship_eta }
      : null
  };
}

export const isOverdue = o => !!o.due_date && o.stage !== 'delivered' && o.due_date < today();
