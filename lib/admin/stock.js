// lib/admin/stock.js — Inventario como LIBRO DE MOVIMIENTOS: stock = SUM(delta). Sin contadores que se desincronicen.
// Cada orden (de cualquier canal) descuenta stock de los productos que referencia por `sku`; cotizaciones no descuentan.
import { all, batch } from '../db.js';
import { nowIso } from '../orders.js';
import { parseJSON } from './http.js';

/**
 * Deja el libro de la orden EXACTAMENTE como debe estar. Idempotente: crear, editar, cambiar de etapa o borrar la orden
 * llaman a esto y solo se inserta la diferencia (nunca doble descuento, y borrar la orden devuelve las piezas).
 */
export async function reconcileStock(folio) {
  const [order] = await all('SELECT stage, items FROM orders WHERE folio = ?', [folio]);
  const desired = {};
  if (order && order.stage !== 'quote') {
    for (const i of parseJSON(order.items, [])) if (i.sku) desired[i.sku] = (desired[i.sku] || 0) + (parseInt(i.qty, 10) || 0);
  }
  const current = Object.fromEntries((await all(`SELECT product_id, COALESCE(SUM(delta), 0) AS s FROM stock_moves WHERE folio = ? AND reason = 'order' GROUP BY product_id`, [folio])).map(r => [r.product_id, r.s]));
  const stmts = [];
  for (const id of new Set([...Object.keys(desired), ...Object.keys(current)])) {
    const diff = -(desired[id] || 0) - (current[id] || 0);
    if (diff) stmts.push({ sql: `INSERT INTO stock_moves (product_id, delta, reason, folio, at) VALUES (?, ?, 'order', ?, ?)`, params: [id, diff, folio, nowIso()] });
  }
  if (stmts.length) await batch(stmts);
  return stmts.length;
}

/** { product_id: stock } — solo productos con control de inventario (con al menos un movimiento). */
export async function stockLevels() {
  return Object.fromEntries((await all('SELECT product_id, COALESCE(SUM(delta), 0) AS s FROM stock_moves GROUP BY product_id')).map(r => [r.product_id, r.s]));
}
