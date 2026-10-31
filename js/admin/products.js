// js/admin/products.js — Editor del catálogo. Lo que guardas aquí lo ve el sitio (caché de borde ~1 min) y lo cobra Stripe.
import { api } from './api.js';
import { el, field, select, money, toast, modal, confirmBox, badge } from './ui.js';
import { SECTORS } from '../catalog.js'; // una sola fuente de verdad para sectores y subsectores

const CATS = [['promo', 'Promocional'], ['screen', 'Serigrafía'], ['3d', 'Impresión 3D'], ['cut', 'Corte láser'], ['ia', 'Diseño IA']];

export async function renderProducts(root) {
  const holder = el('div', { class: 'adm-table-wrap' });
  root.replaceChildren(el('div', { class: 'adm-toolbar' }, el('h1', {}, 'Catálogo'),
    el('span', { class: 'adm-hint' }, 'Los cambios se ven en el sitio en ~1 minuto.'),
    el('button', { class: 'btn red', type: 'button', onclick: () => edit(null) }, '+ Nuevo producto')), holder);

  async function load() {
    const { products } = await api('products');
    holder.replaceChildren(products.length ? el('table', { class: 'adm-table' },
      el('thead', {}, el('tr', {}, ['', 'Producto', 'Precio', 'Sector', 'Estado', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, products.map(p => el('tr', {},
        el('td', {}, p.img ? el('img', { class: 'adm-thumb', src: p.img, alt: '', loading: 'lazy' }) : el('span', { class: 'adm-thumb tag' }, p.tag || '📦')),
        el('td', {}, el('strong', {}, p.name), el('small', {}, p.specs || p.id)),
        el('td', {}, money(p.price), el('small', {}, p.unit || 'pieza')),
        el('td', {}, p.categoria ? `${SECTORS[p.categoria]?.name || p.categoria}` : '—', el('small', {}, SECTORS[p.categoria]?.subs.find(s => s.id === p.subcategoria)?.name || '')),
        el('td', {}, p.hidden ? badge('Oculto', 'low') : badge('Visible', 'good')),
        el('td', { class: 'adm-row-actions' },
          el('button', { class: 'btn', type: 'button', onclick: () => edit(p) }, 'Editar'),
          el('button', { class: 'btn danger', type: 'button', onclick: async () => {
            if (!(await confirmBox(`¿Eliminar «${p.name}» del catálogo?`, { ok: 'Eliminar', danger: true }))) return;
            try { await api('products', { method: 'DELETE', query: { id: p.id } }); toast('Producto eliminado'); await load(); } catch (e) { toast(e.message); }
          } }, 'Eliminar'))))))
      : el('p', { class: 'adm-empty' }, 'El catálogo está vacío (el sitio mostrará data/products.json). Crea un producto.'));
  }

  function edit(p) {
    const isNew = !p;
    p = p || { name: '', price: 0, cat: 'promo', categoria: '', subcategoria: '', tag: '', unit: '', img: '', specs: '', hidden: false };
    const m = modal(isNew ? 'Nuevo producto' : `Editar: ${p.name}`);
    const name = el('input', { type: 'text', value: p.name, maxlength: '80' });
    const price = el('input', { type: 'number', min: '0', step: '0.01', value: p.price });
    const cat = select(CATS, p.cat);
    const sector = select([['', '— Ninguno —'], ...Object.entries(SECTORS).filter(([k]) => k !== 'all').map(([k, v]) => [k, v.name])], p.categoria || '');
    const sub = select([['', '—']], '');
    const fillSubs = () => { sub.replaceChildren(el('option', { value: '' }, '—'), ...(SECTORS[sector.value]?.subs || []).map(s => el('option', { value: s.id, selected: s.id === p.subcategoria }, s.name))); };
    sector.addEventListener('change', () => { p = { ...p, subcategoria: '' }; fillSubs(); });
    fillSubs();
    const tag = el('input', { type: 'text', value: p.tag || '', maxlength: '12', placeholder: '3D, SLA, TOTE…' });
    const unit = el('input', { type: 'text', value: p.unit || '', maxlength: '30', placeholder: 'desde 10 pzs' });
    const img = el('input', { type: 'text', value: p.img || '', placeholder: 'img/producto.jpg  ó  https://…' });
    const specs = el('textarea', { rows: 3, maxlength: '400', value: p.specs || '', placeholder: 'Material, medidas, técnica de impresión… (se muestra en la tarjeta)' });
    const hidden = el('input', { type: 'checkbox', checked: !!p.hidden });
    const err = el('p', { class: 'adm-error', role: 'alert', hidden: true });
    m.body.append(
      el('div', { class: 'adm-grid' },
        field('Nombre', name, 'span2'), field('Precio (MXN)', price), field('Unidad', unit),
        field('Categoría interna', cat), field('Etiqueta de la tarjeta', tag),
        field('Sector del catálogo', sector), field('Subsector', sub),
        field('Imagen', img, 'span2'), field('Especificaciones', specs, 'span2'),
        el('label', { class: 'fld span2 check' }, hidden, el('span', {}, 'Oculto en el catálogo (sigue disponible para el carrito, como "Muestra IA")'))),
      err,
      el('div', { class: 'adm-actions' }, el('button', { class: 'btn red', type: 'button', onclick: async (ev) => {
        const btn = ev.currentTarget; // currentTarget es null después de un await: se captura ANTES
        btn.disabled = true; err.hidden = true;
        const body = { name: name.value, price: price.value, cat: cat.value, categoria: sector.value, subcategoria: sub.value, tag: tag.value, unit: unit.value, img: img.value, specs: specs.value, hidden: hidden.checked };
        try {
          if (isNew) await api('products', { method: 'POST', body });
          else await api('products', { method: 'PUT', query: { id: p.id }, body });
          m.close(); toast('Producto guardado'); await load();
        } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; }
      } }, 'Guardar')));
  }
  await load();
}
