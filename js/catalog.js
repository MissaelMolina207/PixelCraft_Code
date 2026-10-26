import { $, fmt, wa } from './utils.js';
import { store } from './store.js';

const SECTORS = {
  all: { name: 'Todo el Catálogo', subs: [] },
  textil: {
    name: 'Sector Textil',
    subs: [
      { id: 'playeras-camisas', name: 'Playeras y camisas', icon: '👕' },
      { id: 'sudaderas-hoodies', name: 'Sudaderas y hoodies', icon: '🧥' },
      { id: 'uniformes', name: 'Uniformes de trabajo', icon: '👔' },
      { id: 'mandiles', name: 'Mandiles y delantales', icon: '🤿' }
    ]
  },
  promocionales: {
    name: 'Artículos Promocionales',
    subs: [
      { id: 'gorras-viseras', name: 'Gorras y viseras', icon: '🧢' },
      { id: 'bolsas-ecologicas', name: 'Bolsas ecológicas (tote)', icon: '🛍️' },
      { id: 'cristaleria-tazas', name: 'Tazas y vasos', icon: '☕' },
      { id: 'papeleria-oficina', name: 'Papelería y oficina', icon: '📝' },
      { id: 'llaveros-encendedores', name: 'Llaveros y encendedores', icon: '🔑' }
    ]
  },
  publicidad: {
    name: 'Impresión, Corte y Publicidad',
    subs: [
      { id: 'plotter', name: 'Impresión en plotter', icon: '🾛' },
      { id: 'sellos', name: 'Sellos', icon: '📑' },
      { id: 'laser', name: 'Impresión láser', icon: '🖨️' },
      { id: 'senaletica', name: 'Señalética', icon: '🪧' },
      { id: 'corte-laser', name: 'Corte láser', icon: '⚡' },
      { id: 'grabado-laser', name: 'Grabado láser', icon: '🔥' },
      { id: 'promocionales', name: 'Promocionales', icon: '🎁' },
      { id: 'recorte-vinil', name: 'Recorte de vinil', icon: '✂️' },
      { id: 'etiquetas', name: 'Etiquetas', icon: '🏷️' },
      { id: 'tarjetas', name: 'Tarjetas de presentación', icon: '📇' }
    ]
  }
};

let activeSector = 'all';
let activeSub = '';
let scrolled = false;

function renderChips() {
  const container = $('#chips');
  if (!container) return;

  container.innerHTML = Object.entries(SECTORS).map(([k, v]) => 
    `<button class="chip ${activeSector === k && !activeSub ? 'active' : ''}" data-sector="${k}" aria-pressed="${activeSector === k}">${v.name}</button>`
  ).join('');

  renderSubChips();
}

function renderSubChips() {
  const container = $('#subchips');
  const wrapper = $('#subchipsWrapper');
  if (!container) return;

  const currentSector = SECTORS[activeSector];
  if (!currentSector || !currentSector.subs || currentSector.subs.length === 0) {
    if (wrapper) wrapper.style.display = 'none';
    return;
  }

  if (wrapper) wrapper.style.display = 'flex';

  container.innerHTML = currentSector.subs.map(sub => `
    <button class="shortcut-card ${activeSub === sub.id ? 'active' : ''}" data-sub="${sub.id}">
      <div class="shortcut-icon">${sub.icon || '📦'}</div>
      <span class="shortcut-label">${sub.name}</span>
    </button>
  `).join('');
}

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
            ${p.img ? `<img src="${p.img}" alt="${p.name}">` : `<div class="thumb">${p.tag || '📦'}</div>`}
          </div>
          <div class="card-body">
            <h3 style="font-size:1.1rem; margin-bottom: 8px;">${p.name}</h3>
            <div class="price" style="font-size: 1.25rem; font-weight: bold; color: var(--red); margin-bottom: 12px;">
              ${fmt(p.price)} <small style="font-size: 0.8rem; color: var(--soft);">${p.unit || 'pieza'}</small>
            </div>
            <div class="card-actions" style="display: flex; flex-direction: column; gap: 8px;">
              <button class="btn red" data-add="${p.id}">Comprar muestra directa</button>
              <a class="btn" target="_blank" rel="noopener" href="${wa(store.site.whatsapp, 'Hola PixelCraft, quiero cotizar modelos personalizados para: ' + p.name)}">Cotizar otros modelos</a>
              <button class="btn ai-redesign-btn" data-ai-name="${p.name}" style="background: var(--black-2); border: 1px solid var(--line);">✨ Rediseñar con IA</button>
            </div>
          </div>
        </article>
      `).join('')
    : '<p style="color: var(--soft); width: 100%; text-align: center; padding: 20px;">No encontramos productos con esos filtros. Escríbenos y lo fabricamos a la medida.</p>';
}

export function initCatalog() {
  renderChips();
  renderGrid();

  const chipsContainer = $('#chips');
  if (chipsContainer) {
    chipsContainer.onclick = e => {
      const sectorBtn = e.target.closest('[data-sector]');
      if (sectorBtn) {
        activeSector = sectorBtn.dataset.sector;
        activeSub = '';
        renderChips();
        renderGrid();
      }
    };
  }

  const subchipsContainer = $('#subchips');
  if (subchipsContainer) {
    subchipsContainer.onclick = e => {
      const subBtn = e.target.closest('[data-sub]');
      if (subBtn) {
        const clickedSub = subBtn.dataset.sub;
        activeSub = (activeSub === clickedSub) ? '' : clickedSub; // Toggle
        renderSubChips();
        renderGrid();
      }
    };
  }

  // Delegación de eventos para el grid (Rediseñar con IA / Carrito)
  const gridContainer = $('#grid');
  if (gridContainer) {
    gridContainer.onclick = e => {
      const aiBtn = e.target.closest('[data-ai-name]');
      if (aiBtn) {
        const productName = aiBtn.dataset.aiName;
        const promptInput = $('#prompt');
        const estudioSection = $('#estudio');

        if (promptInput) {
          promptInput.value = `Personalización profesional para ${productName}: estilo moderno, limpio y comercial.`;
        }
        if (estudioSection) {
          estudioSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };
  }

  // Desplazamiento horizontal - Productos
  const grid = $('#grid');
  const catNext = $('#catNext');
  const catPrev = $('#catPrev');
  if (grid && catNext && catPrev) {
    catNext.onclick = () => grid.scrollBy({ left: 300, behavior: 'smooth' });
    catPrev.onclick = () => grid.scrollBy({ left: -300, behavior: 'smooth' });
  }

  // Desplazamiento horizontal - Chips
  const chipsEl = $('#chips');
  const chipsNext = $('#chipsNext');
  const chipsPrev = $('#chipsPrev');
  if (chipsEl && chipsNext && chipsPrev) {
    chipsNext.onclick = () => chipsEl.scrollBy({ left: 250, behavior: 'smooth' });
    chipsPrev.onclick = () => chipsEl.scrollBy({ left: -250, behavior: 'smooth' });
  }

  // Desplazamiento horizontal - Subchips / Atajos
  const subchipsEl = $('#subchips');
  const subchipsNext = $('#subchipsNext');
  const subchipsPrev = $('#subchipsPrev');
  if (subchipsEl && subchipsNext && subchipsPrev) {
    subchipsNext.onclick = () => subchipsEl.scrollBy({ left: 250, behavior: 'smooth' });
    subchipsPrev.onclick = () => subchipsEl.scrollBy({ left: -250, behavior: 'smooth' });
  }

  const searchInput = $('#q');
  if (searchInput) {
    searchInput.oninput = () => {
      if (!scrolled) {
        const catSection = $('#catalogo');
        if (catSection) catSection.scrollIntoView();
        scrolled = true;
      }
      renderGrid();
    };
  }
}