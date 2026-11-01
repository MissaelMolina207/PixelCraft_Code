// lib/calc.js — Calculadoras de costos. PURAS (sin red ni DOM): el panel las usa en el navegador y los tests en Node.
// OJO: los DEFAULTS son valores de EJEMPLO. Ajústalos a tus costos reales en el panel («Guardar configuración»).

export const DEFAULTS = {
  screen: {            // A) Serigrafía / promocionales — modelo de COMISIÓN (tú intermedias, el proveedor produce)
    garmentCost: 60,   // costo base de la prenda, por pieza
    screenCost: 250,   // revelado: costo por pantalla (1 pantalla por tinta/color)
    printCost: 3,      // impresión: costo por tinta por pieza
    extras: 0,         // fletes, empaque, etc. (monto fijo del pedido)
    marginPct: 30,     // margen comercial configurable
    marginMode: 'markup' // 'markup' = % sobre el costo · 'price' = % sobre el precio de venta
  },
  print3d: {           // B) Impresión 3D — producción PROPIA (toda la utilidad es tuya)
    materialPerKg: 400, // filamento / resina: costo por kilo
    watts: 200,         // consumo de la impresora
    kwhPrice: 2.5,      // costo de la electricidad por kWh
    machineHourly: 0,   // desgaste de máquina por hora (opcional)
    extras: 0,          // post-proceso, empaque… por pieza
    wastePct: 5,        // margen por mermas y fallas
    multiplier: 3       // multiplicador de ganancia sobre el costo real
  }
};

export const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const num = (v, label, { min = 0, max = 1e9, int = false } = {}) => {
  const n = Number(v);
  if (v === '' || v == null || !Number.isFinite(n)) throw new Error(`${label}: escribe un número`);
  if (n < min || n > max) throw new Error(`${label}: debe estar entre ${min} y ${max}`);
  if (int && !Number.isInteger(n)) throw new Error(`${label}: debe ser un número entero`);
  return n;
};

/**
 * A) Serigrafía / promocionales (modelo de comisión).
 * Costo del proveedor = prendas + revelado (pantallas) + impresión + extras.
 * Precio al cliente = costo × (1 + m)           si marginMode = 'markup'
 *                   = costo ÷ (1 − m)           si marginMode = 'price'  (m < 100 %)
 * Tu comisión como intermediario = precio − costo del proveedor.
 */
export function calcScreen(i) {
  const qty = num(i.qty, 'Cantidad', { min: 1, max: 1e6, int: true });
  const colors = num(i.colors, 'Colores / tintas', { min: 0, max: 12, int: true });
  const garmentCost = num(i.garmentCost, 'Costo de la prenda');
  const screenCost = num(i.screenCost, 'Costo de revelado por pantalla');
  const printCost = num(i.printCost, 'Costo de impresión por tinta/pieza');
  const extras = num(i.extras ?? 0, 'Extras');
  const m = num(i.marginPct, 'Margen', { min: 0, max: i.marginMode === 'price' ? 99.99 : 1000 });
  const garments = qty * garmentCost;
  const screens = colors * screenCost;
  const printing = qty * colors * printCost;
  const supplierTotal = garments + screens + printing + extras;
  const price = i.marginMode === 'price' ? supplierTotal / (1 - m / 100) : supplierTotal * (1 + m / 100);
  const commission = price - supplierTotal;
  return {
    qty, colors,
    breakdown: { garments: round2(garments), screens: round2(screens), printing: round2(printing), extras: round2(extras) },
    supplierTotal: round2(supplierTotal), supplierUnit: round2(supplierTotal / qty),
    price: round2(price), priceUnit: round2(price / qty),
    commission: round2(commission), commissionPctOfPrice: price > 0 ? round2((commission / price) * 100) : 0,
    commissionPctOfCost: supplierTotal > 0 ? round2((commission / supplierTotal) * 100) : 0
  };
}

/**
 * B) Impresión 3D (producción propia).
 * Costo por pieza = (material + electricidad + desgaste + extras) × (1 + mermas)
 * Precio = costo × multiplicador. Utilidad = precio − costo (100 % tuya).
 */
export function calc3d(i) {
  const qty = num(i.qty, 'Cantidad', { min: 1, max: 1e6, int: true });
  const grams = num(i.grams, 'Gramos por pieza', { min: 0.01 });
  const hours = num(i.hours, 'Horas de impresión por pieza', { min: 0 });
  const materialPerKg = num(i.materialPerKg, 'Costo del material por kilo');
  const watts = num(i.watts, 'Consumo (W)', { max: 100000 });
  const kwhPrice = num(i.kwhPrice, 'Costo por kWh');
  const machineHourly = num(i.machineHourly ?? 0, 'Desgaste por hora');
  const extras = num(i.extras ?? 0, 'Extras por pieza');
  const wastePct = num(i.wastePct, 'Mermas (%)', { max: 100 });
  const multiplier = num(i.multiplier, 'Multiplicador', { min: 1, max: 100 });
  const material = (grams / 1000) * materialPerKg;
  const energy = (watts / 1000) * hours * kwhPrice;
  const machine = hours * machineHourly;
  const base = material + energy + machine + extras;
  const waste = base * (wastePct / 100);
  const cost = base + waste;
  const price = cost * multiplier;
  const profit = price - cost;
  const per = { material: round2(material), energy: round2(energy), machine: round2(machine), extras: round2(extras), waste: round2(waste), cost: round2(cost), price: round2(price), profit: round2(profit) };
  return {
    qty, perPiece: per,
    total: { cost: round2(cost * qty), price: round2(price * qty), profit: round2(profit * qty) },
    profitPctOfPrice: price > 0 ? round2((profit / price) * 100) : 0
  };
}

/** Texto de la ficha técnica interna que se guarda con la cotización (queda el desglose para auditar el precio). */
export function describeScreen(i, r) {
  return [`Serigrafía/promocionales · modelo comisión`, `Cantidad: ${r.qty} · Tintas: ${r.colors}`,
    `Prendas $${r.breakdown.garments} · Revelado $${r.breakdown.screens} · Impresión $${r.breakdown.printing} · Extras $${r.breakdown.extras}`,
    `Costo proveedor $${r.supplierTotal} ($${r.supplierUnit}/pz) · Margen ${i.marginPct}% ${i.marginMode === 'price' ? 'sobre precio' : 'sobre costo'}`,
    `Precio $${r.price} ($${r.priceUnit}/pz) · Comisión $${r.commission}`].join('\n');
}
export function describe3d(i, r) {
  const p = r.perPiece;
  return [`Impresión 3D · producción propia`, `Cantidad: ${r.qty} · ${i.grams} g/pz · ${i.hours} h/pz`,
    `Por pieza: material $${p.material} · energía $${p.energy} · desgaste $${p.machine} · extras $${p.extras} · mermas ${i.wastePct}% $${p.waste}`,
    `Costo real $${p.cost}/pz · ×${i.multiplier} = $${p.price}/pz`, `Total $${r.total.price} · Utilidad neta $${r.total.profit} (100% propia)`].join('\n');
}
