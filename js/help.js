// js/help.js — Sección #ayuda: pestañas por tema + acordeón nativo (<details>, accesible sin JS extra).
// El contenido vive en data/help.json. Todo texto entra con textContent. Los mínimos salen del catálogo (siempre al día).
import { $, getJSON, wa } from './utils.js';
import { store } from './store.js';

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid);
  return n;
};

/** Párrafos separados por \n. */
const paragraphs = text => String(text).split('\n').map(t => el('p', {}, t));

/** Productos visibles cuya unidad empieza con «desde»: «Playera serigrafía 1 tinta — desde 12 pzs». */
function minimumsFromCatalog() {
  const rows = (store.products || []).filter(p => !p.hidden && /^desde/i.test(p.unit || ''));
  return el('div', { class: 'help-a' },
    rows.length ? el('ul', { class: 'help-min' }, rows.map(p => el('li', {}, el('span', {}, p.name), el('b', {}, p.unit))))
      : el('p', {}, 'Los mínimos dependen de cada producto: te los confirmamos al cotizar.'),
    el('p', {}, 'Para probar antes de producir hay muestra desde 1 pieza. Si necesitas menos del mínimo, escríbenos: a veces se puede.'));
}

export async function initHelp() {
  const tabs = $('#helpTabs'), body = $('#helpBody');
  if (!tabs || !body) return;
  const { groups } = await getJSON('data/help.json');

  const show = id => {
    [...tabs.children].forEach(b => b.setAttribute('aria-selected', String(b.dataset.id === id)));
    body.replaceChildren(...groups.filter(g => g.id === id).map(g => el('div', { class: 'help-group', role: 'tabpanel' },
      g.items.map(it => it.auto === 'minimums'
        ? el('div', { class: 'help-item' }, el('div', { class: 'help-q static' }, 'Mínimos por producto'), minimumsFromCatalog())
        : el('details', { class: 'help-item', name: `help-${id}` }, el('summary', { class: 'help-q' }, it.q), el('div', { class: 'help-a' }, paragraphs(it.a)))))));
  };
  tabs.replaceChildren(...groups.map(g => el('button', { class: 'help-tab', type: 'button', role: 'tab', 'data-id': g.id }, g.title)));
  [...tabs.children].forEach((b, i) => b.addEventListener('click', () => show(groups[i].id)));
  show(groups[0].id);

  const w = $('#helpWa');
  if (w && store.site?.whatsapp) w.href = wa(store.site.whatsapp, 'Hola PixelCraft, tengo una duda: ');
}
