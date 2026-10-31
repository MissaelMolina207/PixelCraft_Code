// js/admin/orders.js — Lista de órdenes + formulario completo (cliente, pedido, finanzas, producción, envío, tareas, historial).
import { api } from './api.js';
import { el, field, select, money, pct, fdate, STAGES, stageLabel, toast, modal, confirmBox, badge } from './ui.js';

const TYPES = ['Particular', 'Empresa', 'Agencia', 'Artista'];
const CHANNELS = ['WhatsApp', 'Estudio IA', 'Web', 'Presencial', 'Otro'];
const TASK_STATUS = [['todo', 'Por hacer'], ['doing', 'En proceso'], ['done', 'Hecha']];
const state = { q: '', stage: 'active' }; // los filtros sobreviven al cambiar de pestaña

let carriers;
async function loadCarriers() {
  if (carriers) return carriers;
  try { carriers = Object.keys((await (await fetch('data/carriers.json')).json()).carriers); }
  catch { carriers = ['Estafeta', 'DHL', 'FedEx', 'UPS']; }
  return carriers;
}

const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const waLink = (phone, text) => `https://wa.me/${phone.length === 10 ? '52' + phone : phone}?text=${encodeURIComponent(text)}`;
const trackLink = folio => `${location.origin}/rastreo.html?folio=${encodeURIComponent(folio)}`;

// ======================= LISTA =======================
export async function renderOrders(root) {
  const holder = el('div', { class: 'adm-table-wrap' });
  const search = el('input', { type: 'search', placeholder: 'Buscar folio, cliente, teléfono, guía…', value: state.q, 'aria-label': 'Buscar órdenes' });
  const stageSel = select([['active', 'Activas'], ['all', 'Todas'], ...STAGES.map(s => [s.key, s.short])], state.stage, { 'aria-label': 'Filtrar por etapa' });
  root.replaceChildren(
    el('div', { class: 'adm-toolbar' }, el('h1', {}, 'Órdenes'), search, stageSel,
      el('button', { class: 'btn red', type: 'button', onclick: () => openOrder(null, { onSaved: load }) }, '+ Nueva orden')),
    holder);

  async function load() {
    const { orders } = await api('orders', { query: { stage: state.stage === 'all' ? '' : state.stage, q: state.q } });
    holder.replaceChildren(table(orders));
  }
  const safeLoad = () => load().catch(e => toast(e.message));
  search.addEventListener('input', debounce(() => { state.q = search.value; safeLoad(); }, 250));
  stageSel.addEventListener('change', () => { state.stage = stageSel.value; safeLoad(); });
  await load();

  function table(orders) {
    if (!orders.length) return el('p', { class: 'adm-empty' }, state.q || state.stage !== 'active' ? 'Ninguna orden coincide con el filtro.' : 'Aún no hay órdenes activas. Crea la primera con «+ Nueva orden».');
    const open = o => openOrder(o.folio, { onSaved: load });
    return el('table', { class: 'adm-table' },
      el('thead', {}, el('tr', {}, ['Folio', 'Cliente', 'Pedido', 'Etapa', 'Entrega', 'Venta', 'Margen', 'Por cobrar', 'Guía'].map(h => el('th', {}, h)))),
      el('tbody', {}, orders.map(o => el('tr', { tabindex: 0, class: 'clickable', onclick: () => open(o), onkeydown: e => { if (e.key === 'Enter') open(o); } },
        el('td', { class: 'mono' }, o.folio),
        el('td', {}, o.customer_name, el('small', {}, o.customer_type)),
        el('td', { class: 'clip' }, o.title),
        el('td', {}, badge(stageLabel(o.stage), `st-${o.stage}`)),
        el('td', { class: o.overdue ? 'neg' : '' }, fdate(o.due_date), o.overdue ? el('small', {}, 'vencida') : null),
        el('td', {}, money(o.price)),
        el('td', { class: o.margin < 0 ? 'neg' : o.marginPct < 20 && o.price > 0 ? 'low' : 'good' }, money(o.margin), el('small', {}, pct(o.marginPct))),
        el('td', { class: o.balance > 0 ? 'low' : '' }, money(o.balance)),
        el('td', { class: 'mono' }, o.guide || '—')))));
  }
}

// ======================= FORMULARIO =======================
/**
 * @param folio  null = nueva orden
 * @param opts   { stage: etapa preseleccionada, onSaved: callback para refrescar la vista que lo abrió }
 */
export async function openOrder(folio, { stage, onSaved } = {}) {
  let emps, cars, detail;
  try { [emps, cars, detail] = await Promise.all([api('employees').then(r => r.employees), loadCarriers(), folio ? api('orders', { query: { folio } }) : null]); }
  catch (e) { return toast(e.message); }

  const o = detail?.order || { customer_name: '', phone: '', customer_type: 'Particular', channel: 'WhatsApp', title: '', items: [], specs: '', stage: 'approved', price: 0, cost: 0, paid: 0, supplier: '', due_date: '', carrier: '', guide: '', track_url: '', ship_eta: '', notes: '', public_note: '' };
  if (stage) o.stage = stage;
  const m = modal(folio ? `Orden ${folio}` : 'Nueva orden', { wide: true });

  // ---- controles ----
  const f = {};
  const text = (k, props = {}) => (f[k] = el('input', { type: 'text', value: o[k] ?? '', ...props }));
  const num = k => (f[k] = el('input', { type: 'number', min: '0', step: '0.01', value: o[k] ?? 0 }));
  const date = k => (f[k] = el('input', { type: 'date', value: o[k] ?? '' }));
  const area = (k, rows) => (f[k] = el('textarea', { rows, value: o[k] ?? '' }));
  f.customer_type = select(TYPES, o.customer_type);
  f.channel = select(CHANNELS, o.channel);
  f.stage = select(STAGES.map(s => [s.key, s.label]), o.stage);
  f.carrier = select([['', '— Sin paquetería —'], ...cars.map(c => [c, c])], o.carrier);
  if (o.carrier && !cars.includes(o.carrier)) f.carrier.append(el('option', { value: o.carrier, selected: true }, o.carrier));
  f.event_note = el('input', { type: 'text', maxlength: '200', placeholder: 'Opcional: ej. "Enviado a Textiles del Bajío, lote 14"' });

  // ---- partidas ----
  const itemsBox = el('div', { class: 'adm-items' });
  const addItem = (it = { name: '', qty: 1, specs: '' }) => {
    const row = el('div', { class: 'adm-item' },
      el('input', { 'data-k': 'name', placeholder: 'Producto (ej. Playera negra cuello redondo)', value: it.name }),
      el('input', { 'data-k': 'qty', type: 'number', min: '1', value: it.qty, 'aria-label': 'Cantidad' }),
      el('input', { 'data-k': 'specs', placeholder: 'Talla, color, tinta…', value: it.specs }),
      el('button', { type: 'button', class: 'adm-x', 'aria-label': 'Quitar partida', onclick: () => row.remove() }, '✕'));
    itemsBox.append(row);
  };
  (o.items.length ? o.items : [undefined]).forEach(addItem);
  const collectItems = () => [...itemsBox.children].map(r => ({ name: r.querySelector('[data-k=name]').value, qty: r.querySelector('[data-k=qty]').value, specs: r.querySelector('[data-k=specs]').value }));

  // ---- margen en vivo ----
  const marginBox = el('div', { class: 'adm-margin' });
  const updMargin = () => {
    const p = +f.price.value || 0, c = +f.cost.value || 0, d = +f.paid.value || 0, mg = p - c, pc = p > 0 ? Math.round((mg / p) * 1000) / 10 : 0;
    marginBox.className = `adm-margin ${mg < 0 ? 'neg' : pc < 20 ? 'low' : 'good'}`;
    marginBox.replaceChildren(
      el('div', {}, el('small', {}, 'Margen'), el('strong', {}, `${money(mg)} · ${pct(pc)}`)),
      el('div', {}, el('small', {}, 'Por cobrar'), el('strong', {}, money(p - d))));
  };

  const sec = (title, ...kids) => el('fieldset', { class: 'adm-sec' }, el('legend', {}, title), el('div', { class: 'adm-grid' }, kids));
  const err = el('p', { class: 'adm-error', role: 'alert', hidden: true });
  const save = el('button', { class: 'btn red', type: 'button' }, folio ? 'Guardar cambios' : 'Crear orden');

  const form = el('div', { class: 'adm-form' },
    !folio ? sec('Folio', field('Folio (opcional; si lo dejas vacío se genera PC-####)', text('folio', { placeholder: 'PC-1001', maxlength: '20' }))) : null,
    sec('Cliente', field('Nombre', text('customer_name', { maxlength: '80' })), field('Teléfono (con el que cotizó)', text('phone', { type: 'tel', inputmode: 'numeric', placeholder: '4621234567' })),
      field('Tipo de cliente', f.customer_type), field('Canal', f.channel)),
    sec('Pedido', field('Resumen visible para el cliente', text('title', { maxlength: '120', placeholder: '15 playeras negras serigrafía frente' }), 'span2'),
      el('div', { class: 'span2' }, el('span', { class: 'fld-label' }, 'Partidas (el cliente las ve en su rastreo)'), itemsBox,
        el('button', { class: 'btn', type: 'button', onclick: () => addItem() }, '+ Partida')),
      field('Ficha técnica INTERNA (tela, técnica, tintas, filamento, % relleno, archivos…)', area('specs', 3), 'span2')),
    sec('Finanzas (internas)', field('Precio de venta', num('price')), field('Costo (proveedor + insumos)', num('cost')), field('Anticipo / pagado', num('paid')), marginBox),
    sec('Producción', field('Etapa', f.stage), field('Proveedor', text('supplier', { maxlength: '80' })), field('Fecha de entrega', date('due_date')),
      field('Nota del cambio de etapa (queda en el historial)', f.event_note, 'span2')),
    sec('Envío', field('Paquetería', f.carrier), field('Número de guía', text('guide', { maxlength: '40' })), field('Llegada estimada', date('ship_eta')),
      field('Enlace de rastreo (opcional, https://)', text('track_url', { maxlength: '400' }))),
    sec('Notas', field('Notas internas', area('notes', 2)), field('Mensaje visible al cliente', area('public_note', 2, { maxlength: '300' }))));
  ['price', 'cost', 'paid'].forEach(k => f[k].addEventListener('input', updMargin));
  updMargin();
  m.body.append(form);

  // ---- tareas e historial (solo en edición) ----
  if (folio) {
    const empOpts = (cur, curName) => {
      const list = emps.filter(e => e.active).map(e => [String(e.id), e.name + (e.area ? ` (${e.area})` : '')]);
      if (cur && !list.some(([v]) => v === String(cur))) list.push([String(cur), `${curName || 'Empleado'} (inactivo)`]);
      return [['0', 'Sin asignar'], ...list];
    };
    const tasksBox = el('div', { class: 'adm-tasks' });
    const reloadTasks = async () => { renderTasks((await api('tasks', { query: { folio } })).tasks); };
    const renderTasks = tasks => tasksBox.replaceChildren(...(tasks.length ? tasks.map(t => el('div', { class: `adm-task ${t.status}` },
      select(TASK_STATUS, t.status, { 'aria-label': 'Estado', onchange: e => api('tasks', { method: 'PUT', query: { id: t.id }, body: { status: e.target.value } }).then(reloadTasks).catch(x => toast(x.message)) }),
      el('span', { class: 'adm-task-title' }, t.title, t.area ? el('small', {}, t.area) : null),
      select(empOpts(t.employee_id, t.employee_name), String(t.employee_id), { 'aria-label': 'Responsable', onchange: e => api('tasks', { method: 'PUT', query: { id: t.id }, body: { employee_id: e.target.value } }).then(reloadTasks).catch(x => toast(x.message)) }),
      el('input', { type: 'date', value: t.due_date, 'aria-label': 'Fecha límite', onchange: e => api('tasks', { method: 'PUT', query: { id: t.id }, body: { due_date: e.target.value } }).catch(x => toast(x.message)) }),
      el('button', { class: 'adm-x', type: 'button', 'aria-label': 'Eliminar tarea', onclick: () => api('tasks', { method: 'DELETE', query: { id: t.id } }).then(reloadTasks).catch(x => toast(x.message)) }, '✕')))
      : [el('p', { class: 'adm-empty' }, 'Sin tareas todavía.')]));
    renderTasks(detail.tasks);

    const newTitle = el('input', { type: 'text', placeholder: 'Nueva tarea (ej. Preparar pantallas de serigrafía)', maxlength: '120' });
    const newEmp = select(empOpts(0), '0', { 'aria-label': 'Responsable' });
    const newDue = el('input', { type: 'date', 'aria-label': 'Fecha límite' });
    const addTask = async () => {
      if (!newTitle.value.trim()) return;
      try { await api('tasks', { method: 'POST', body: { folio, title: newTitle.value, employee_id: newEmp.value, due_date: newDue.value } }); newTitle.value = ''; await reloadTasks(); }
      catch (e) { toast(e.message); }
    };
    newTitle.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } });
    m.body.append(
      el('fieldset', { class: 'adm-sec' }, el('legend', {}, 'Tareas de taller'), tasksBox,
        el('div', { class: 'adm-task-new' }, newTitle, newEmp, newDue, el('button', { class: 'btn', type: 'button', onclick: addTask }, 'Agregar'))),
      el('fieldset', { class: 'adm-sec' }, el('legend', {}, 'Historial'),
        el('ol', { class: 'adm-events' }, detail.events.map(e => el('li', {}, el('b', {}, stageLabel(e.stage)), ` · ${fdate(e.at)}`, e.note ? el('small', {}, e.note) : null)))));
  }

  // ---- acciones ----
  const collect = () => {
    const d = {};
    for (const k of ['customer_name', 'phone', 'customer_type', 'channel', 'title', 'specs', 'stage', 'price', 'cost', 'paid', 'supplier', 'due_date', 'carrier', 'guide', 'track_url', 'ship_eta', 'notes', 'public_note']) d[k] = f[k].value;
    d.items = collectItems();
    return d;
  };
  save.addEventListener('click', async () => {
    const d = collect();
    if (d.stage === 'shipping' && !d.guide.trim() && !d.track_url.trim() &&
        !(await confirmBox('Vas a marcar la orden "En camino" sin número de guía. El cliente verá el paso sin datos de envío. ¿Guardar de todos modos?', { ok: 'Guardar igual' }))) return;
    save.disabled = true;
    err.hidden = true;
    try {
      if (folio) { await api('orders', { method: 'PUT', query: { folio }, body: { ...d, event_note: f.event_note.value } }); toast('Orden actualizada'); }
      else { const r = await api('orders', { method: 'POST', body: { ...d, folio: f.folio.value.trim() || undefined } }); toast(`Orden ${r.folio} creada`); }
      m.close();
      onSaved?.();
    } catch (e) { err.textContent = e.message; err.hidden = false; err.scrollIntoView({ block: 'nearest' }); }
    finally { save.disabled = false; }
  });

  const actions = [save];
  if (folio) {
    const stageNow = () => stageLabel(f.stage.value);
    actions.push(
      el('button', { class: 'btn', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(trackLink(folio)); toast('Enlace de rastreo copiado'); } catch { toast(trackLink(folio)); } } }, 'Copiar enlace de rastreo'),
      el('a', { class: 'btn', target: '_blank', rel: 'noopener', href: '#', onclick: e => { e.currentTarget.href = waLink(String(f.phone.value).replace(/\D/g, ''), `Hola ${f.customer_name.value.split(' ')[0]}, te escribimos de PixelCraft. Tu pedido ${folio} (${f.title.value}) va en: ${stageNow()}. Puedes ver el avance aquí: ${trackLink(folio)} (usa los últimos 4 dígitos de tu teléfono).`); } }, 'Avisar por WhatsApp'),
      el('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (!(await confirmBox(`¿Eliminar la orden ${folio}? Se borran también sus tareas e historial. No se puede deshacer.`, { ok: 'Eliminar', danger: true }))) return;
        try { await api('orders', { method: 'DELETE', query: { folio } }); toast('Orden eliminada'); m.close(); onSaved?.(); } catch (e) { toast(e.message); }
      } }, 'Eliminar'));
  }
  m.body.append(err, el('div', { class: 'adm-actions' }, actions));
}
