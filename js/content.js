// js/content.js — Contenido dinámico de la tienda: botones y insignias del hero, barra de cupos, valor y proceso.
// Fuente: /api/site (editable en /admin → Sitio, con cupos reales). Si falla (p. ej. `npm run static`): data/content.json + data/site.json.
import { $, getJSON } from './utils.js';
import { store } from './store.js';
import { el } from './dom.js';
import { icon } from './icons.js';

export async function loadSite() {
  try {
    const r = await fetch('/api/site');
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    const content = await getJSON('data/content.json');
    const total = content.capacity.total, used = store.site?.slots?.used ?? 0;
    return { content, capacity: { total, used, available: Math.max(0, total - used), pct: total ? Math.min(100, Math.round((used / total) * 100)) : 0, source: 'static' } };
  }
}

function renderActions(actions) {
  $('#heroActions')?.replaceChildren(...actions.map((a, i) => {
    const cls = `btn ${a.style === 'ghost' ? 'ghost' : 'red'}${i === 0 && a.style !== 'ghost' ? ' pulse' : ''}`;
    if (a.kind === 'studio') return el('a', { class: cls, href: '#estudio', 'data-open-studio': '' }, a.label);
    const external = a.href.startsWith('https://');
    return el('a', { class: cls, href: a.href, ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }, a.label);
  }));
}

const renderBadges = badges => $('#heroBadges')?.replaceChildren(...badges.map(b => el('li', {}, icon(b.icon, 18), el('span', {}, b.text))));

/** Barra de cupos. Es un dato REAL: disponibles = total − órdenes activas del taller (ver api/site.js). */
function renderCapacity(label, cap) {
  const box = $('#capacity');
  if (!box) return;
  box.hidden = cap.total <= 0;
  if (cap.total <= 0) return;
  $('#capLabel').textContent = label;
  $('#capTxt').textContent = cap.available > 0 ? `${cap.available} de ${cap.total} disponibles` : 'Sin cupos esta semana';
  $('#capBar i').style.width = `${cap.pct}%`;
  $('#capBar').setAttribute('aria-valuenow', String(cap.pct));
  box.classList.toggle('hot', cap.pct >= 70);
  $('#capNote').textContent = cap.available <= 0 ? 'Cotiza y te decimos la siguiente fecha de producción disponible.'
    : cap.pct >= 70 ? 'Quedan pocos cupos: cotiza ahora para apartar el tuyo.' : 'Se actualiza con los pedidos reales del taller.';
}

function renderValue(v) {
  $('#valueTitle').textContent = v.title;
  const lead = $('#valueLead'); lead.textContent = v.lead; lead.hidden = !v.lead;
  $('#valueGrid').replaceChildren(...v.items.map(it => el('article', { class: 'value-card' },
    el('span', { class: 'icon-tile' }, icon(it.icon, 24)), el('h3', {}, it.title), el('p', {}, it.text))));
}

function renderProcess(p) {
  $('#processTitle').textContent = p.title;
  const lead = $('#processLead'); lead.textContent = p.lead; lead.hidden = !p.lead;
  $('#processSteps').replaceChildren(...p.steps.map(s => el('li', { class: 'process-step' },
    el('span', { class: 'step-num', 'aria-hidden': 'true' }), el('h3', {}, s.title), el('span', { class: 'icon-tile' }, icon(s.icon, 20)), el('p', {}, s.text))));
}

export function renderSite({ content, capacity }) {
  store.content = content;
  store.capacity = capacity;
  renderActions(content.hero.actions);
  renderBadges(content.badges);
  renderCapacity(content.capacity.label, capacity);
  renderValue(content.value);
  renderProcess(content.process);
  document.dispatchEvent(new CustomEvent('content:ready', { detail: content }));
}
