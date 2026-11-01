// js/admin/channels.js — Canales de venta: ventas por canal, inventario general y mapeo de publicaciones por marketplace.
// PixelCraft es la FUENTE DE VERDAD del stock; n8n empuja los números a cada marketplace (ver tarjeta "Integración").
import { api } from './api.js';
import { el, field, select, money, toast, modal, confirmBox, badge, channelBadge, MARKETPLACES } from './ui.js';

const STATUS = [['active', 'Activa'], ['paused', 'Pausada'], ['draft', 'Borrador']];
const STATUS_CLS = { active: 'good', paused: 'low', draft: '' };

export async function renderChannels(root) {
  const holder = el('div');
  root.replaceChildren(el('div', { class: 'adm-toolbar' }, el('h1', {}, 'Canales de venta'),
    el('span', { class: 'adm-hint' }, 'Un solo inventario para todos los canales.')), holder);

  async function load() {
    const [stats, inv] = await Promise.all([api('stats'), api('inventory')]);
    holder.replaceChildren(salesByChannel(stats), matrix(inv.products), integration(stats.intake));
  }

  // ---------- Ventas por canal ----------
  function salesByChannel(stats) {
    const own = stats.byChannel.filter(c => !MARKETPLACES.includes(c.channel)), mk = stats.byChannel.filter(c => MARKETPLACES.includes(c.channel));
    const sum = list => list.reduce((a, c) => ({ sales: a.sales + c.sales, margin: a.margin + c.margin, fees: a.fees + c.fees, orders: a.orders + c.orders }), { sales: 0, margin: 0, fees: 0, orders: 0 });
    const group = (title, list, cls) => { const t = sum(list); return el('div', { class: `adm-panel adm-group ${cls}` }, el('h2', {}, title),
      el('div', { class: 'adm-kpis tight' }, [['Órdenes', String(t.orders)], ['Ventas', money(t.sales)], ['Comisiones', money(t.fees)], ['Utilidad', money(t.margin)]].map(([l, v]) => el('div', { class: 'adm-kpi' }, el('small', {}, l), el('strong', {}, v)))),
      list.length ? el('ul', { class: 'adm-list' }, list.map(c => el('li', {}, el('div', {}, channelBadge(c.channel), el('small', {}, `${c.orders} orden${c.orders === 1 ? '' : 'es'} · comisiones ${money(c.fees)}`)), el('span', {}, el('strong', {}, money(c.sales)), el('small', {}, `utilidad ${money(c.margin)}`)))))
        : el('p', { class: 'adm-empty' }, 'Sin ventas todavía.')); };
    return el('div', { class: 'adm-two' }, group('Tienda propia · WhatsApp · Estudio IA', own, 'own'), group('Marketplaces', mk, 'mk'));
  }

  // ---------- Matriz producto × canal ----------
  function matrix(products) {
    return el('div', { class: 'adm-panel' }, el('h2', {}, 'Inventario y publicaciones'),
      el('p', { class: 'adm-hint' }, 'Stock = lo que hay en el taller. «Publica» = stock − reserva del canal. Las ventas de cualquier canal lo descuentan solas (partidas con producto del inventario).'),
      el('div', { class: 'adm-table-wrap flat' }, el('table', { class: 'adm-table' },
        el('thead', {}, el('tr', {}, ['Producto', 'Stock', 'Tienda web', ...MARKETPLACES].map(h => el('th', {}, h)))),
        el('tbody', {}, products.map(p => el('tr', {},
          el('td', {}, el('strong', {}, p.name), el('small', {}, p.id)),
          el('td', {}, p.stock == null ? el('span', { class: 'adm-hint' }, 'sin control') : el('strong', { class: p.stock <= 0 ? 'neg' : p.stock < 5 ? 'low' : '' }, String(p.stock)),
            el('button', { class: 'btn adm-mini', type: 'button', onclick: () => editStock(p) }, p.stock == null ? 'Iniciar' : 'Ajustar')),
          el('td', {}, p.hidden ? badge('Oculto', 'low') : badge(`Visible · ${money(p.price)}`, 'good')),
          ...MARKETPLACES.map(ch => cell(p, ch))))))));
  }

  function cell(p, ch) {
    const l = p.listings.find(x => x.channel === ch);
    return el('td', {}, l
      ? el('button', { class: 'adm-cellbtn', type: 'button', onclick: () => editListing(p, ch, l) },
          badge(STATUS.find(s => s[0] === l.status)[1], STATUS_CLS[l.status]), el('strong', {}, money(l.price)),
          el('small', {}, `${l.ext_id || 'sin id'} · publica ${l.available == null ? '—' : l.available}${l.buffer ? ` (reserva ${l.buffer})` : ''}`))
      : el('button', { class: 'btn adm-mini', type: 'button', onclick: () => editListing(p, ch, null) }, '+ Mapear'));
  }

  function editStock(p) {
    const m = modal(`Stock: ${p.name}`);
    const n = el('input', { type: 'number', min: '0', step: '1', value: p.stock ?? 0 });
    m.body.append(el('p', {}, p.stock == null ? 'Este producto no tiene control de inventario. Al guardar lo iniciamos con la cantidad que pongas.' : `Stock actual: ${p.stock}. Escribe el conteo físico real; el sistema registra la diferencia como un ajuste.`),
      field('Stock total en taller', n),
      el('div', { class: 'adm-actions' }, el('button', { class: 'btn red', type: 'button', onclick: async () => {
        try { await api('inventory', { method: 'POST', body: { product_id: p.id, set: n.value } }); m.close(); toast('Stock actualizado'); await load(); } catch (e) { toast(e.message); }
      } }, 'Guardar')));
  }

  function editListing(p, channel, l) {
    const m = modal(`${p.name} en ${channel}`);
    const ext = el('input', { type: 'text', value: l?.ext_id || '', maxlength: '60', placeholder: 'MLM123456789 / ASIN / id de la publicación' });
    const url = el('input', { type: 'text', value: l?.url || '', placeholder: 'https://…' });
    const price = el('input', { type: 'number', min: '0', step: '0.01', value: l?.price ?? p.price });
    const buffer = el('input', { type: 'number', min: '0', step: '1', value: l?.buffer ?? 0 });
    const status = select(STATUS, l?.status || 'active');
    const err = el('p', { class: 'adm-error', role: 'alert', hidden: true });
    m.body.append(el('div', { class: 'adm-grid' }, field('ID de la publicación', ext), field('Estado', status), field('Enlace', url, 'span2'),
      field('Precio publicado en este canal', price), field('Reserva (piezas que NO se publican aquí)', buffer)), err,
      el('div', { class: 'adm-actions' },
        el('button', { class: 'btn red', type: 'button', onclick: async ev => {
          const btn = ev.currentTarget; btn.disabled = true; err.hidden = true;
          const bodyData = { ext_id: ext.value, url: url.value, price: price.value, buffer: buffer.value, status: status.value };
          try {
            if (l) await api('listings', { method: 'PUT', query: { id: l.id }, body: bodyData });
            else await api('listings', { method: 'POST', body: { product_id: p.id, channel, ...bodyData } });
            m.close(); toast('Publicación guardada'); await load();
          } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; }
        } }, 'Guardar'),
        l ? el('button', { class: 'btn danger', type: 'button', onclick: async () => {
          if (!(await confirmBox(`¿Quitar el mapeo de «${p.name}» en ${channel}? No borra la publicación en el marketplace.`, { ok: 'Quitar', danger: true }))) return;
          try { await api('listings', { method: 'DELETE', query: { id: l.id } }); m.close(); await load(); } catch (e) { toast(e.message); }
        } }, 'Quitar mapeo') : null));
  }

  // ---------- Integración n8n ----------
  function integration(configured) {
    const base = location.origin;
    const copy = async t => { try { await navigator.clipboard.writeText(t); toast('Copiado'); } catch { toast(t); } };
    const sample = JSON.stringify({ channel: 'Mercado Libre', ext_ref: '2000012345678', customer_name: 'María López', title: '2 playeras blancas',
      price: 578, fee: 98, cost: 300, items: [{ name: 'Playera blanca', qty: 2, sku: 'playera-1t' }] }, null, 2);
    return el('div', { class: 'adm-panel' }, el('h2', {}, 'Integración con n8n (marketplaces)'),
      el('p', {}, configured ? badge('INTAKE_TOKEN configurado', 'good') : badge('Falta INTAKE_TOKEN en Vercel (mínimo 24 caracteres)', 'neg')),
      el('p', { class: 'adm-hint' }, 'PixelCraft no se conecta directo a Mercado Libre/Amazon/Facebook (cada cuenta exige su propio OAuth). n8n sí: usa estos dos endpoints con el encabezado Authorization: Bearer <INTAKE_TOKEN>.'),
      el('ol', { class: 'adm-steps' },
        el('li', {}, el('b', {}, 'Entrada de órdenes. '), 'POST ', el('code', {}, `${base}/api/channels`), ' cuando n8n detecte una venta. Es idempotente por canal + ext_ref: si reintenta, no duplica. Entra «Por asignar», ya pagada, y descuenta inventario.',
          el('button', { class: 'btn adm-mini', type: 'button', onclick: () => copy(`${base}/api/channels`) }, 'Copiar URL')),
        el('li', {}, el('b', {}, 'Salida de stock. '), 'GET ', el('code', {}, `${base}/api/channels?op=stock&channel=Mercado Libre`), ' devuelve cuánto publicar por producto (stock − reserva) para que n8n lo actualice en el marketplace.',
          el('button', { class: 'btn adm-mini', type: 'button', onclick: () => copy(`${base}/api/channels?op=stock&channel=Mercado Libre`) }, 'Copiar URL'))),
      el('details', {}, el('summary', {}, 'Ver ejemplo de cuerpo JSON'), el('pre', { class: 'adm-code' }, sample)));
  }

  await load();
}
