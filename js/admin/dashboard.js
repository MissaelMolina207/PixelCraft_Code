// js/admin/dashboard.js — Panel: dinero, margen y qué se está quemando hoy.
import { api } from './api.js';
import { el, money, pct, fdate, STAGES, badge } from './ui.js';
import { openOrder } from './orders.js';

const kpi = (label, value, sub, cls = '') => el('div', { class: `adm-kpi ${cls}`.trim() }, el('small', {}, label), el('strong', {}, value), sub ? el('span', {}, sub) : null);

export async function renderDashboard(root) {
  const [s, { orders }] = await Promise.all([api('stats'), api('orders', { query: { stage: 'active' } })]);
  const m = s.month, t = s.total;
  const upcoming = orders.filter(o => o.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 6);

  root.replaceChildren(
    el('div', { class: 'adm-toolbar' }, el('h1', {}, 'Panel'), el('button', { class: 'btn red', type: 'button', onclick: () => openOrder(null, { onSaved: () => renderDashboard(root) }) }, '+ Nueva orden')),
    el('div', { class: 'adm-kpis' },
      kpi('Ventas del mes', money(m.sales), `${m.orders} orden${m.orders === 1 ? '' : 'es'}`),
      kpi('Margen del mes', money(m.margin), pct(m.marginPct), m.margin < 0 ? 'neg' : m.marginPct < 20 && m.sales > 0 ? 'low' : 'good'),
      kpi('Por cobrar', money(t.outstanding), 'todas las órdenes', t.outstanding > 0 ? 'low' : 'good'),
      kpi('Vencidas', String(s.overdue), 'fecha de entrega pasada', s.overdue ? 'neg' : 'good'),
      kpi('Tareas abiertas', String(s.openTasks), 'en el taller')),
    el('div', { class: 'adm-two' },
      el('div', { class: 'adm-panel' }, el('h2', {}, 'Órdenes por etapa'),
        el('ul', { class: 'adm-stagelist' }, STAGES.map(st => el('li', {}, badge(st.short, `st-${st.key}`), el('strong', {}, String(s.byStage[st.key] || 0)))))),
      el('div', { class: 'adm-panel' }, el('h2', {}, 'Próximas entregas'),
        upcoming.length ? el('ul', { class: 'adm-list' }, upcoming.map(o => el('li', { class: 'clickable', tabindex: 0, onclick: () => openOrder(o.folio, { onSaved: () => renderDashboard(root) }), onkeydown: e => { if (e.key === 'Enter') openOrder(o.folio, { onSaved: () => renderDashboard(root) }); } },
          el('div', {}, el('strong', {}, `${o.folio} · ${o.customer_name}`), el('small', {}, o.title)),
          el('span', { class: o.overdue ? 'neg' : '' }, fdate(o.due_date)))))
          : el('p', { class: 'adm-empty' }, 'Ninguna orden activa tiene fecha de entrega.'))),
    el('p', { class: 'adm-hint' }, `Histórico: ${t.orders} orden${t.orders === 1 ? '' : 'es'} · ventas ${money(t.sales)} · costo ${money(t.cost)} · margen ${money(t.margin)} (${pct(t.marginPct)}).`));
}
