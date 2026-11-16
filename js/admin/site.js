// js/admin/site.js — Editor del contenido público: botones y insignias del hero, cupos, valor, proceso y burbuja flotante.
// Todo se valida en el servidor (lib/content.js). Aquí solo hay formularios; los errores del servidor se muestran tal cual.
import { api } from './api.js';
import { el, field, select, toast } from './ui.js';
import { ICON_NAMES, iconSvg } from '../icons.js';

/** Selector de icono con vista previa (el icono se pinta con el mismo registro que usa el sitio). */
function iconPicker(value) {
  const sel = select(ICON_NAMES.map(n => [n, n]), value, { 'aria-label': 'Icono' });
  const prev = el('span', { class: 'adm-icon-prev' });
  const paint = () => { prev.innerHTML = iconSvg(sel.value, 20); };
  sel.addEventListener('change', paint);
  paint();
  return { node: el('span', { class: 'adm-icon-pick' }, prev, sel), sel };
}

/**
 * Lista editable de filas. `fields` describe cada columna: { key, label, kind: 'text'|'icon'|'area' }.
 * Devuelve { node, get() }. Con ↑ ↓ ✕ por fila y un tope de filas.
 */
function repeater({ items, fields, min = 0, max = 8, blank, addLabel }) {
  const box = el('div', { class: 'adm-rep' });
  const rows = [];
  const draw = () => {
    const rowNodes = rows.map((r, i) => {
      const up = el('button', { class: 'adm-x', type: 'button', disabled: i === 0, 'aria-label': 'Subir', onclick: () => { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; draw(); } }, '↑');
      const down = el('button', { class: 'adm-x', type: 'button', disabled: i === rows.length - 1, 'aria-label': 'Bajar', onclick: () => { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; draw(); } }, '↓');
      const del = el('button', { class: 'adm-x', type: 'button', disabled: rows.length <= min, 'aria-label': 'Quitar', onclick: () => { rows.splice(i, 1); draw(); } }, '✕');
      return el('div', { class: 'adm-rep-row' },
        el('div', { class: 'adm-rep-fields' }, r.controls.map(c => c.wrap)),
        el('div', { class: 'adm-rep-btns' }, up, down, del));
    });
    const add = el('button', { class: 'btn', type: 'button', disabled: rows.length >= max, onclick: () => { addRow(blank); draw(); } }, addLabel);
    box.replaceChildren(...rowNodes, add);
  };
  const addRow = item => {
    const controls = fields.map(f => {
      let input, wrap;
      if (f.kind === 'icon') { const p = iconPicker(item[f.key]); input = p.sel; wrap = field(f.label, p.node, f.cls); }
      else if (f.kind === 'area') { input = el('textarea', { rows: 2, maxlength: String(f.max || 300), value: item[f.key] ?? '' }); wrap = field(f.label, input, f.cls); }
      else { input = el('input', { type: 'text', maxlength: String(f.max || 80), value: item[f.key] ?? '' }); wrap = field(f.label, input, f.cls); }
      return { key: f.key, input, wrap };
    });
    rows.push({ controls });
  };
  items.forEach(addRow);
  draw();
  return { node: box, get: () => rows.map(r => Object.fromEntries(r.controls.map(c => [c.key, c.input.value]))) };
}

const panel = (title, hint, ...kids) => el('section', { class: 'adm-panel adm-site-sec' }, el('h2', {}, title), hint ? el('p', { class: 'adm-hint' }, hint) : null, kids);
const lines = t => t.split('\n').map(s => s.trim()).filter(Boolean);

export async function renderSite(root) {
  const [{ value: c }, pub] = await Promise.all([api('settings', { query: { key: 'site' } }), fetch('/api/site').then(r => r.json()).catch(() => null)]);

  // ---- Botones principales (1-3) ----
  const actionRows = c.hero.actions.map(a => {
    const label = el('input', { type: 'text', maxlength: '40', value: a.label });
    const kind = select([['link', 'Enlace'], ['studio', 'Abre el Estudio IA']], a.kind);
    const href = el('input', { type: 'text', maxlength: '300', value: a.href, placeholder: '#contacto · rastreo.html · https://…' });
    const style = select([['red', 'Rojo (principal)'], ['ghost', 'Neutro']], a.style);
    const hrefWrap = field('Enlace', href);
    const sync = () => { hrefWrap.hidden = kind.value === 'studio'; };
    kind.addEventListener('change', sync); sync();
    return { node: el('div', { class: 'adm-rep-row' }, el('div', { class: 'adm-rep-fields' }, field('Texto del botón', label), field('Acción', kind), hrefWrap, field('Estilo', style))), get: () => ({ label: label.value, kind: kind.value, href: href.value, style: style.value }) };
  });

  const badges = repeater({ items: c.badges, min: 0, max: 8, addLabel: '+ Insignia', blank: { icon: 'check', text: '' },
    fields: [{ key: 'icon', label: 'Icono', kind: 'icon' }, { key: 'text', label: 'Texto', kind: 'text', max: 60, cls: 'grow' }] });

  const capLabel = el('input', { type: 'text', maxlength: '60', value: c.capacity.label });
  const capTotal = el('input', { type: 'number', min: '0', max: '500', step: '1', value: c.capacity.total });

  const valueTitle = el('input', { type: 'text', maxlength: '80', value: c.value.title });
  const valueLead = el('input', { type: 'text', maxlength: '200', value: c.value.lead });
  const valueItems = repeater({ items: c.value.items, min: 1, max: 6, addLabel: '+ Tarjeta', blank: { icon: 'star', title: '', text: '' },
    fields: [{ key: 'icon', label: 'Icono', kind: 'icon' }, { key: 'title', label: 'Título', kind: 'text', max: 60 }, { key: 'text', label: 'Texto', kind: 'area', max: 300, cls: 'span2' }] });

  const procTitle = el('input', { type: 'text', maxlength: '80', value: c.process.title });
  const procLead = el('input', { type: 'text', maxlength: '200', value: c.process.lead });
  const steps = repeater({ items: c.process.steps, min: 1, max: 6, addLabel: '+ Paso', blank: { icon: 'check', title: '', text: '' },
    fields: [{ key: 'icon', label: 'Icono', kind: 'icon' }, { key: 'title', label: 'Título', kind: 'text', max: 60 }, { key: 'text', label: 'Texto', kind: 'area', max: 300, cls: 'span2' }] });

  const logo = el('input', { type: 'text', maxlength: '200', value: c.bubble.logo, placeholder: 'img/logo.png  ó  https://…' });
  const msgArea = (list, ph) => el('textarea', { rows: 7, value: list.join('\n'), placeholder: ph });
  const tips = msgArea(c.bubble.tips, 'Un tip por línea'), ads = msgArea(c.bubble.ads, 'Una promo por línea'), recs = msgArea(c.bubble.recs, 'Una recomendación por línea'), jokes = msgArea(c.bubble.jokes, 'Un chiste por línea');

  const err = el('p', { class: 'adm-error', role: 'alert', hidden: true });
  const save = el('button', { class: 'btn red', type: 'button' }, 'Guardar cambios');
  save.addEventListener('click', async () => {
    save.disabled = true; err.hidden = true;
    const value = {
      hero: { actions: actionRows.map(r => r.get()) }, badges: badges.get(),
      capacity: { label: capLabel.value, total: capTotal.value },
      value: { title: valueTitle.value, lead: valueLead.value, items: valueItems.get() },
      process: { title: procTitle.value, lead: procLead.value, steps: steps.get() },
      bubble: { logo: logo.value, tips: lines(tips.value), ads: lines(ads.value), recs: lines(recs.value), jokes: lines(jokes.value) }
    };
    try { await api('settings', { method: 'PUT', query: { key: 'site' }, body: { value } }); toast('Guardado. El sitio lo muestra en ~30 segundos.'); }
    catch (e) { err.textContent = e.message; err.hidden = false; err.scrollIntoView({ block: 'center' }); }
    finally { save.disabled = false; }
  });

  const live = pub ? `Ahora mismo: ${pub.capacity.used} orden${pub.capacity.used === 1 ? '' : 'es'} activa${pub.capacity.used === 1 ? '' : 's'} en el taller → ${pub.capacity.available} cupo${pub.capacity.available === 1 ? '' : 's'} disponible${pub.capacity.available === 1 ? '' : 's'}.` : '';
  root.replaceChildren(
    el('div', { class: 'adm-toolbar' }, el('h1', {}, 'Contenido del sitio'), el('a', { class: 'btn', href: 'index.html', target: '_blank', rel: 'noopener' }, 'Ver el sitio')),
    panel('Botones principales', 'Los que ves bajo el carrusel. El primero en rojo late para llamar la atención.', actionRows.map(r => r.node)),
    panel('Insignias de confianza', 'Cada una con su icono. Úsalas solo para cosas ciertas: son promesas.', badges.node),
    panel('Barra de cupos de producción', 'Solo defines el total semanal. Los cupos usados son REALES: cada orden activa en el taller (Por asignar, En taller o Control de calidad) ocupa uno, sin importar el canal. Las cotizaciones no ocupan cupo.',
      el('div', { class: 'adm-grid' }, field('Etiqueta', capLabel), field('Cupos totales por semana (0 oculta la barra)', capTotal)), live ? el('p', { class: 'adm-hint' }, live) : null),
    panel('Propuesta de valor', null, el('div', { class: 'adm-grid' }, field('Título', valueTitle), field('Texto de apoyo (opcional)', valueLead)), valueItems.node),
    panel('Proceso', null, el('div', { class: 'adm-grid' }, field('Título', procTitle), field('Texto de apoyo (opcional)', procLead)), steps.node),
    panel('Burbuja flotante del Estudio IA', 'Un mensaje se elige al azar cada cierto tiempo (hasta 12 por visita) y quien lo desee puede silenciarlos. Máximo 40 por categoría, 160 caracteres cada uno.',
      el('div', { class: 'adm-grid' }, field('Logo en el centro de la burbuja (ruta o https; vacío = destello)', logo, 'span2'),
        field('Tips de uso', tips), field('Promociones', ads), field('Recomendaciones', recs), field('Chistes', jokes))),
    err, el('div', { class: 'adm-actions adm-savebar' }, save));
}
