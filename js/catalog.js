// js/catalog.js — Catálogo: chips de categoría en UNA línea + cuadrícula de productos.
//
// Comportamiento pedido:
//   • "Todo el catálogo": todas las categorías principales, en una sola línea.
//   • Al elegir una categoría: su botón pasa a ser el PRIMERO de la izquierda y, pegadas a él, aparecen sus
//     subcategorías con icono. Las demás categorías quedan a la derecha de un separador (para poder cambiar o volver).
//
// Técnica FLIP (First, Last, Invert, Play) — la forma barata de animar un reordenamiento:
//   1) First : mide dónde está cada chip ANTES de reordenar.
//   2) Last  : reordena el DOM y mide dónde quedó cada uno.
//   3) Invert: con `transform` lo regresas visualmente a donde estaba (parece que no se movió).
//   4) Play  : animas el transform hasta 0. El navegador anima SOLO transform (rápido, sin recalcular layout).
import { $, fmt, wa } from './utils.js';
import { store } from './store.js';
import { iconSvg } from './icons.js';
import { addItem, openCart } from './cart.js';

// Los textos del catálogo se editan en /admin: SIEMPRE escapados antes de ir a innerHTML.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// `icon` = nombre del registro lib/icons.js (SVG que hereda el color del tema; los emoji cambian de dibujo según el sistema).
export const SECTORS = {
  all: { name: 'Todo el Catálogo', subs: [] },
  textil: {
    name: 'Sector Textil',
    subs: [
      { id: 'playeras-camisas', name: 'Playeras y camisas', icon: 'shirt' },
      { id: 'sudaderas-hoodies', name: 'Sudaderas y hoodies', icon: 'hoodie' },
      { id: 'uniformes', name: 'Uniformes de trabajo', icon: 'tie' },
      { id: 'mandiles', name: 'Mandiles y delantales', icon: 'apron' }
    ]
  },
  promocionales: {
    name: 'Artículos Promocionales',
    subs: [
      { id: 'gorras-viseras', name: 'Gorras y viseras', icon: 'cap' },
      { id: 'bolsas-ecologicas', name: 'Bolsas ecológicas (tote)', icon: 'bag' },
      { id: 'cristaleria-tazas', name: 'Tazas y vasos', icon: 'mug' },
      { id: 'papeleria-oficina', name: 'Papelería y oficina', icon: 'notebook' },
      { id: 'llaveros-encendedores', name: 'Llaveros y encendedores', icon: 'key' }
    ]
  },
  publicidad: {
    name: 'Impresión, Corte y Publicidad',
    subs: [
      { id: 'plotter', name: 'Impresión en plotter', icon: 'plotter' },
      { id: 'sellos', name: 'Sellos', icon: 'stamp' },
      { id: 'laser', name: 'Impresión láser', icon: 'printer' },
      { id: 'senaletica', name: 'Señalética', icon: 'signpost' },
      { id: 'corte-laser', name: 'Corte láser', icon: 'bolt' },
      { id: 'grabado-laser', name: 'Grabado láser', icon: 'flame' },
      { id: 'promocionales', name: 'Promocionales', icon: 'gift' },
      { id: 'recorte-vinil', name: 'Recorte de vinil', icon: 'scissors' },
      { id: 'etiquetas', name: 'Etiquetas', icon: 'tag' },
      { id: 'tarjetas', name: 'Tarjetas de presentación', icon: 'card' }
    ]
  }
};

let activeSector = 'all';
let activeSub = '';
let scrolled = false;

// ---------------------------------------------------------------- chips
const sectorBtn = ([k, v]) =>
  `<button class="chip sector" type="button" data-sector="${k}" aria-pressed="${k === activeSector}">${esc(v.name)}</button>`;

/** Orden del DOM: [categoría elegida][sus subcategorías] | [las demás categorías]. */
function chipsMarkup() {
  const all = Object.entries(SECTORS);
  if (activeSector === 'all') return all.map(sectorBtn).join('');
  const subs = SECTORS[activeSector].subs.map(s =>
    `<button class="chip sub" type="button" data-sub="${s.id}" aria-pressed="${activeSub === s.id}">${iconSvg(s.icon, 18)}<span>${esc(s.name)}</span></button>`).join('');
  return sectorBtn([activeSector, SECTORS[activeSector]]) + subs +
    '<span class="chips-sep" aria-hidden="true"></span>' + all.filter(([k]) => k !== activeSector).map(sectorBtn).join('');
}

const visibleLeft = (el, box) => el.getBoundingClientRect().left - box.getBoundingClientRect().left;

function renderChips({ animate = false } = {}) {
  const box = $('#chips');
  if (!box) return;

  // 1) FIRST
  const first = animate ? new Map([...box.querySelectorAll('.sector')].map(b => [b.dataset.sector, visibleLeft(b, box)])) : null;

  // 2) LAST
  box.innerHTML = chipsMarkup();
  box.scrollTo({ left: 0, behavior: 'instant' });   // el elegido queda a la vista, pegado a la izquierda

  if (animate && !reduceMotion()) {
    const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
    for (const b of box.querySelectorAll('.sector')) {
      const dx = (first.get(b.dataset.sector) ?? 0) - visibleLeft(b, box);
      // 3) INVERT + 4) PLAY
      if (Math.abs(dx) > 1) b.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 360, easing: ease });
    }
    // Las subcategorías entran en cascada: opacidad + un pequeño desplazamiento, con retraso escalonado
    box.querySelectorAll('.sub').forEach((b, i) =>
      b.animate([{ opacity: 0, transform: 'translateX(-14px) scale(0.94)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 90 + i * 35, easing: ease, fill: 'backwards' }));
  }
  updateChipArrows();
}

/** Las flechas solo aparecen si hay algo que desplazar en esa dirección. */
function updateChipArrows() {
  const box = $('#chips'), prev = $('#chipsPrev'), next = $('#chipsNext');
  if (!box || !prev || !next) return;
  const max = box.scrollWidth - box.clientWidth;
  prev.hidden = max <= 2 || box.scrollLeft <= 2;
  next.hidden = max <= 2 || box.scrollLeft >= max - 2;
}

// ---------------------------------------------------------------- productos
function renderGrid() {
  const grid = $('#grid');
  if (!grid) return;
  const q = $('#q') ? $('#q').value.trim().toLowerCase() : '';

  const list = store.products.filter(p => {
    if (p.hidden) return false;
    const matchQuery = !q || p.name.toLowerCase().includes(q);
    const matchSector = activeSector === 'all' || p.categoria === activeSector;
    const matchSub = !activeSub || p.subcategoria === activeSub;
    return matchQuery && matchSector && matchSub;
  });

  grid.innerHTML = list.length
    ? list.map(p => `
        <article class="card pro-card">
          <div class="card-gallery">
            ${p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">` : `<div class="thumb" aria-hidden="true">${esc(p.tag) || '📦'}</div>`}
          </div>
          <div class="card-body">
            <h3 style="font-size:1.1rem; margin-bottom: 8px;">${esc(p.name)}</h3>
            ${p.specs ? `<p style="font-size: 0.85rem; color: var(--muted); margin: 0 0 10px;">${esc(p.specs)}</p>` : ''}
            <div class="price" style="font-size: 1.25rem; font-weight: bold; margin-bottom: 12px;">
              ${fmt(p.price)} <small style="font-size: 0.8rem; color: var(--muted); font-weight: 400;">${esc(p.unit) || 'pieza'}</small>
            </div>
            <div class="card-actions" style="display: flex; flex-direction: column; gap: 8px;">
              <button class="btn red" data-add="${esc(p.id)}">Comprar muestra directa</button>
              <a class="btn" target="_blank" rel="noopener" href="${wa(store.site.whatsapp, 'Hola PixelCraft, quiero cotizar modelos personalizados para: ' + p.name)}">Cotizar otros modelos</a>
              <button class="btn ai-redesign-btn" data-ai-name="${esc(p.name)}">✨ Rediseñar con IA</button>
            </div>
          </div>
        </article>
      `).join('')
    : '<p style="color: var(--muted); width: 100%; text-align: center; padding: 20px;">No encontramos productos con esos filtros. Escríbenos y lo fabricamos a la medida.</p>';
}

// ---------------------------------------------------------------- arranque
export function initCatalog() {
  renderChips();
  renderGrid();

  const box = $('#chips');
  if (box) {
    // Delegación de eventos: UN solo listener para todos los chips (incluidos los que se vuelven a crear en cada render).
    box.addEventListener('click', e => {
      const sec = e.target.closest('[data-sector]');
      const sub = e.target.closest('[data-sub]');
      if (sec) {
        activeSector = sec.dataset.sector;
        activeSub = '';
        renderChips({ animate: true });
        renderGrid();
        $('#chips [data-sector]')?.focus({ preventScroll: true });   // el foco sigue al botón (ahora es el primero)
      } else if (sub) {
        activeSub = activeSub === sub.dataset.sub ? '' : sub.dataset.sub; // segundo clic = quitar el filtro
        box.querySelectorAll('.sub').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sub === activeSub)));
        renderGrid();
      }
    });
    box.addEventListener('scroll', updateChipArrows, { passive: true });
    new ResizeObserver(updateChipArrows).observe(box);
    $('#chipsPrev')?.addEventListener('click', () => box.scrollBy({ left: -box.clientWidth * 0.7, behavior: 'smooth' }));
    $('#chipsNext')?.addEventListener('click', () => box.scrollBy({ left: box.clientWidth * 0.7, behavior: 'smooth' }));
  }

  $('#grid')?.addEventListener('click', e => {
    // "Comprar muestra directa": agrega UNA pieza al carrito y lo abre. Solo viaja el id: el servidor recalcula el precio al cobrar.
    const add = e.target.closest('[data-add]');
    if (add) {
      const p = store.products.find(x => x.id === add.dataset.add);
      if (p) { addItem({ id: p.id, name: p.name, price: p.price, img: p.img || '' }); openCart(); }
      return;
    }
    // "Rediseñar con IA" abre el Estudio (burbuja/panel) con el producto ya mencionado. El módulo float.js escucha este evento.
    const ai = e.target.closest('[data-ai-name]');
    if (ai) document.dispatchEvent(new CustomEvent('studio:open', { detail: { prompt: `Personalización profesional para ${ai.dataset.aiName}: estilo moderno, limpio y comercial.` } }));
  });

  // Desplazamiento horizontal de productos (flechas con mouse; en táctil se desliza)
  const grid = $('#grid');
  $('#catNext')?.addEventListener('click', () => grid.scrollBy({ left: 300, behavior: 'smooth' }));
  $('#catPrev')?.addEventListener('click', () => grid.scrollBy({ left: -300, behavior: 'smooth' }));

  const search = $('#q');
  if (search) {
    search.addEventListener('input', () => {
      if (!scrolled) { $('#catalogo')?.scrollIntoView(); scrolled = true; }
      renderGrid();
    });
  }
}
