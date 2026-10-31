// js/admin/board.js — Tablero de producción (Kanban). Mover tarjetas = cambiar etapa (con evento en el historial).
// Accesible: cada tarjeta tiene botones ◀ ▶ además de arrastrar y soltar.
import { api } from './api.js';
import { el, money, fdate, STAGES, toast, badge } from './ui.js';
import { openOrder } from './orders.js';

export async function renderBoard(root) {
  const board = el('div', { class: 'adm-board' });
  root.replaceChildren(el('div', { class: 'adm-toolbar' }, el('h1', {}, 'Tablero de producción'),
    el('button', { class: 'btn red', type: 'button', onclick: () => openOrder(null, { onSaved: load }) }, '+ Nueva orden')), board);

  let orders = [];
  async function load() {
    orders = (await api('orders', { query: { stage: '' } })).orders;
    draw();
  }

  async function move(o, stage) {
    if (o.stage === stage) return;
    // A "En camino" sin guía: abrimos la orden para capturarla en vez de dejar el paso vacío.
    if (stage === 'shipping' && !o.guide && !o.track_url) return openOrder(o.folio, { stage, onSaved: load });
    try { await api('orders', { method: 'PUT', query: { folio: o.folio }, body: { stage } }); toast(`${o.folio} → ${STAGES.find(s => s.key === stage).short}`); await load(); }
    catch (e) { toast(e.message); }
  }

  function card(o, i) {
    const k = STAGES.findIndex(s => s.key === o.stage);
    return el('article', { class: 'adm-card', draggable: 'true', tabindex: 0,
      ondragstart: e => { e.dataTransfer.setData('text/plain', o.folio); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('drag'); },
      ondragend: e => e.currentTarget.classList.remove('drag'),
      onkeydown: e => { if (e.key === 'Enter') openOrder(o.folio, { onSaved: load }); } },
      el('div', { class: 'adm-card-top', onclick: () => openOrder(o.folio, { onSaved: load }) },
        el('span', { class: 'mono' }, o.folio), o.overdue ? badge('vencida', 'neg') : null),
      el('strong', { onclick: () => openOrder(o.folio, { onSaved: load }) }, o.customer_name),
      el('p', {}, o.title),
      el('div', { class: 'adm-card-meta' },
        el('span', {}, `📅 ${fdate(o.due_date)}`),
        o.balance > 0 ? badge(`Por cobrar ${money(o.balance)}`, 'low') : badge('Pagada', 'good'),
        o.openTasks ? badge(`${o.openTasks} tarea${o.openTasks > 1 ? 's' : ''}`) : null),
      o.assignees.length ? el('small', {}, '👷 ' + o.assignees.join(', ')) : null,
      el('div', { class: 'adm-card-move' },
        el('button', { class: 'adm-x', type: 'button', disabled: k === 0, 'aria-label': 'Etapa anterior', onclick: () => move(o, STAGES[k - 1].key) }, '◀'),
        el('button', { class: 'adm-x', type: 'button', disabled: k === STAGES.length - 1, 'aria-label': 'Etapa siguiente', onclick: () => move(o, STAGES[k + 1].key) }, '▶')));
  }

  function draw() {
    board.replaceChildren(...STAGES.map(s => {
      const list = orders.filter(o => o.stage === s.key).slice(0, s.key === 'delivered' ? 8 : 100);
      const total = orders.filter(o => o.stage === s.key).length;
      const col = el('section', { class: `adm-col st-${s.key}`, 'aria-label': s.label,
        ondragover: e => { e.preventDefault(); col.classList.add('over'); },
        ondragleave: () => col.classList.remove('over'),
        ondrop: e => { e.preventDefault(); col.classList.remove('over'); const o = orders.find(x => x.folio === e.dataTransfer.getData('text/plain')); if (o) move(o, s.key); } },
        el('h3', {}, s.short, el('span', {}, String(total))),
        list.length ? list.map(card) : el('p', { class: 'adm-empty' }, 'Vacío'));
      return col;
    }));
  }
  await load();
}
