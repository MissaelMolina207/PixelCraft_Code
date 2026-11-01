// js/admin/calc.js — Calculadoras financieras. Las fórmulas viven en lib/calc.js (puras, probadas en Node); aquí solo UI.
//   A) Serigrafía / promocionales (modelo de comisión): costo del proveedor + margen → tu comisión exacta.
//   B) Impresión 3D (producción propia): costo real de insumos + mermas × multiplicador → utilidad 100 % tuya.
// «Guardar como cotización» abre la orden precargada en etapa "Cotizada" y al guardar genera el folio PC-####.
import { api } from './api.js';
import { el, field, select, money, toast } from './ui.js';
import { openOrder } from './orders.js';
import { DEFAULTS, calcScreen, calc3d, describeScreen, describe3d } from '../../lib/calc.js';

const state = { tab: 'screen' };

export async function renderCalc(root) {
  let cfg;
  try { cfg = (await api('settings', { query: { key: 'calc' } })).value; } catch { cfg = structuredClone(DEFAULTS); } // sin DB, las calculadoras igual sirven

  const body = el('div');
  const tabs = el('div', { class: 'adm-subtabs', role: 'tablist' },
    ...[['screen', 'A · Serigrafía / Promocionales (comisión)'], ['print3d', 'B · Impresión 3D (producción propia)']].map(([k, label]) =>
      el('button', { class: 'btn', type: 'button', role: 'tab', 'aria-selected': String(state.tab === k), onclick: () => { state.tab = k; draw(); } }, label)));
  root.replaceChildren(el('div', { class: 'adm-toolbar' }, el('h1', {}, 'Calculadoras de costos y utilidad')), tabs, body);

  function draw() {
    [...tabs.children].forEach((b, i) => b.setAttribute('aria-selected', String(['screen', 'print3d'][i] === state.tab)));
    body.replaceChildren(state.tab === 'screen' ? screenCard() : printCard());
  }

  /** Construye una tarjeta: inputs a la izquierda, resultados en vivo a la derecha, acciones abajo. */
  function card({ group, fields, compute, summary, toDraft, customerText }) {
    const inputs = {};
    const desc = el('input', { type: 'text', maxlength: '100', placeholder: 'Ej. Playera blanca cuello redondo' });
    const grid = el('div', { class: 'adm-grid' }, field('Descripción del pedido (para la cotización)', desc, 'span2'),
      fields.map(([k, label, props = {}]) => {
        if (props.options) return field(label, (inputs[k] = select(props.options, cfg[group][k])));
        return field(label, (inputs[k] = el('input', { type: 'number', min: props.min ?? '0', step: props.step ?? '0.01', value: props.value ?? cfg[group][k] ?? '' })));
      }));
    const out = el('div', { class: 'adm-calc-out', 'aria-live': 'polite' });
    const values = () => Object.fromEntries(Object.entries(inputs).map(([k, c]) => [k, c.value]));
    let last = null;

    const run = () => {
      try { last = { v: values(), r: compute(values()) }; out.replaceChildren(...summary(last.r, last.v)); saveBtn.disabled = copyBtn.disabled = false; }
      catch (e) { last = null; out.replaceChildren(el('p', { class: 'adm-error' }, e.message)); saveBtn.disabled = copyBtn.disabled = true; }
    };
    const saveBtn = el('button', { class: 'btn red', type: 'button', onclick: () => last && openOrder(null, {
      prefill: toDraft(last.v, last.r, desc.value.trim()), onSaved: () => { location.hash = '#orders'; } }) }, 'Guardar como cotización (genera folio)');
    const copyBtn = el('button', { class: 'btn', type: 'button', onclick: async () => {
      if (!last) return;
      const t = customerText(last.v, last.r, desc.value.trim());
      try { await navigator.clipboard.writeText(t); toast('Mensaje para el cliente copiado'); } catch { toast(t); }
    } }, 'Copiar mensaje para el cliente');
    const cfgBtn = el('button', { class: 'btn', type: 'button', onclick: async () => {
      const next = structuredClone(cfg);
      for (const [k] of Object.entries(DEFAULTS[group])) if (k in inputs && inputs[k].value !== '') next[group][k] = typeof DEFAULTS[group][k] === 'number' ? Number(inputs[k].value) : inputs[k].value;
      // Las cantidades del pedido NO son configuración: solo se guardan los costos y márgenes base.
      try { await api('settings', { method: 'PUT', query: { key: 'calc' }, body: { value: next } }); cfg = next; toast('Configuración guardada: será tu punto de partida'); } catch (e) { toast(e.message); }
    } }, 'Guardar como mi configuración');
    const resetBtn = el('button', { class: 'btn', type: 'button', onclick: () => { for (const [k, c] of Object.entries(inputs)) if (k in DEFAULTS[group]) c.value = DEFAULTS[group][k]; run(); } }, 'Restablecer ejemplo');
    Object.values(inputs).forEach(c => c.addEventListener('input', run));
    Object.values(inputs).forEach(c => c.addEventListener('change', run));
    queueMicrotask(run);
    return el('div', { class: 'adm-calc' }, el('div', { class: 'adm-panel' }, grid, el('div', { class: 'adm-actions' }, cfgBtn, resetBtn)),
      el('div', { class: 'adm-panel adm-calc-side' }, out, el('div', { class: 'adm-actions' }, saveBtn, copyBtn)));
  }

  const row = (label, value, cls = '') => el('div', { class: `adm-calc-row ${cls}`.trim() }, el('span', {}, label), el('strong', {}, value));

  function screenCard() {
    return card({
      group: 'screen',
      fields: [['qty', 'Cantidad de prendas', { value: 50, min: '1', step: '1' }], ['colors', 'Colores / tintas', { value: 2, step: '1' }],
        ['garmentCost', 'Costo base de la prenda (por pieza)'], ['screenCost', 'Revelado (costo por pantalla)'], ['printCost', 'Impresión (costo por tinta por pieza)'],
        ['extras', 'Extras del pedido (fletes, empaque)'], ['marginPct', 'Margen comercial (%)'],
        ['marginMode', 'El margen se calcula…', { options: [['markup', 'Sobre el costo (markup)'], ['price', 'Sobre el precio de venta']] }]],
      compute: v => calcScreen(v),
      summary: r => [
        row('Prendas', money(r.breakdown.garments)), row('Revelado de pantallas', money(r.breakdown.screens)),
        row('Impresión', money(r.breakdown.printing)), row('Extras', money(r.breakdown.extras)),
        row('Costo al proveedor', `${money(r.supplierTotal)}  ·  ${money(r.supplierUnit)}/pz`, 'sum'),
        row('Precio al cliente', `${money(r.price)}  ·  ${money(r.priceUnit)}/pz`, 'sum'),
        el('div', { class: 'adm-calc-big good' }, el('small', {}, 'Tu comisión como intermediario'), el('strong', {}, money(r.commission)),
          el('span', {}, `${r.commissionPctOfCost}% sobre el costo · ${r.commissionPctOfPrice}% del precio de venta`))],
      toDraft: (v, r, d) => ({ stage: 'quote', channel: 'WhatsApp', title: `${r.qty} ${d || 'piezas'} · serigrafía ${r.colors} tinta${r.colors === 1 ? '' : 's'}`.slice(0, 120),
        items: [{ name: d || 'Pieza serigrafiada', qty: r.qty, specs: `${r.colors} tinta${r.colors === 1 ? '' : 's'}`, sku: '' }],
        price: r.price, cost: r.supplierTotal, specs: describeScreen(v, r), notes: `Cotización calculada. Comisión como intermediario: ${money(r.commission)}.` }),
      customerText: (v, r, d) => `Cotización PixelCraft: ${r.qty} ${d || 'piezas'} con serigrafía de ${r.colors} tinta${r.colors === 1 ? '' : 's'}.\nPrecio total: ${money(r.price)} (${money(r.priceUnit)} por pieza).\n¿Te la apartamos? Con tu anticipo iniciamos producción.`
    });
  }

  function printCard() {
    return card({
      group: 'print3d',
      fields: [['qty', 'Cantidad de piezas', { value: 10, min: '1', step: '1' }], ['grams', 'Gramos por pieza', { value: 50, min: '0.01' }], ['hours', 'Horas de impresión por pieza', { value: 2 }],
        ['materialPerKg', 'Material: costo por kilo (filamento / resina)'], ['watts', 'Consumo de la impresora (W)'], ['kwhPrice', 'Costo de la electricidad (por kWh)'],
        ['machineHourly', 'Desgaste de máquina (por hora, opcional)'], ['extras', 'Extras por pieza (post-proceso, empaque)'],
        ['wastePct', 'Mermas y fallas (%)'], ['multiplier', 'Multiplicador de ganancia (×)', { min: '1' }]],
      compute: v => calc3d(v),
      summary: (r, v) => { const p = r.perPiece; return [
        row('Material', money(p.material)), row('Electricidad', money(p.energy)), row('Desgaste de máquina', money(p.machine)), row('Extras', money(p.extras)),
        row(`Mermas (${v.wastePct}%)`, money(p.waste)),
        row('Costo real por pieza', money(p.cost), 'sum'), row(`Precio por pieza (×${v.multiplier})`, money(p.price), 'sum'),
        row(`Total ${r.qty} pz: costo / precio`, `${money(r.total.cost)}  /  ${money(r.total.price)}`, 'sum'),
        el('div', { class: 'adm-calc-big good' }, el('small', {}, 'Utilidad neta (100 % tuya)'), el('strong', {}, money(r.total.profit)),
          el('span', {}, `${money(p.profit)} por pieza · ${r.profitPctOfPrice}% del precio`))]; },
      toDraft: (v, r, d) => ({ stage: 'quote', channel: 'WhatsApp', title: `${r.qty} × ${d || 'pieza'} · impresión 3D`.slice(0, 120),
        items: [{ name: d || 'Pieza impresa en 3D', qty: r.qty, specs: `${v.grams} g · ${v.hours} h`, sku: '' }],
        price: r.total.price, cost: r.total.cost, specs: describe3d(v, r), notes: `Cotización calculada. Utilidad neta: ${money(r.total.profit)} (producción propia).` }),
      customerText: (v, r, d) => `Cotización PixelCraft: ${r.qty} × ${d || 'pieza impresa en 3D'}.\nPrecio total: ${money(r.total.price)} (${money(r.perPiece.price)} por pieza).\n¿Te la apartamos? Con tu anticipo iniciamos producción.`
    });
  }
  draw();
}
