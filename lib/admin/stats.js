// lib/admin/stats.js — Panel de control: una sola ida a la base (batch) con todos los números.
// Las COTIZACIONES (stage = 'quote') no son ventas: se cuentan aparte como "pipeline".
import { batch } from '../db.js';
import { round2 } from '../orders.js';

export async function statsHandler() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const agg = `COUNT(*) AS n, COALESCE(SUM(price), 0) AS sales, COALESCE(SUM(cost), 0) AS cost, COALESCE(SUM(fee), 0) AS fee, COALESCE(SUM(price - paid), 0) AS outstanding`;
  const [all, month, stages, overdue, tasks, channels, quotes, stock] = (await batch([
    { sql: `SELECT ${agg} FROM orders WHERE stage != 'quote'`, params: [] },
    { sql: `SELECT ${agg} FROM orders WHERE stage != 'quote' AND created_at >= ?`, params: [monthStart] },
    { sql: `SELECT stage, COUNT(*) AS n FROM orders GROUP BY stage`, params: [] },
    { sql: `SELECT COUNT(*) AS n FROM orders WHERE due_date != '' AND due_date < ? AND stage NOT IN ('delivered', 'quote')`, params: [today] },
    { sql: `SELECT COUNT(*) AS n FROM tasks WHERE status != 'done'`, params: [] },
    { sql: `SELECT channel, ${agg} FROM orders WHERE stage != 'quote' GROUP BY channel ORDER BY sales DESC`, params: [] },
    { sql: `SELECT COUNT(*) AS n, COALESCE(SUM(price), 0) AS value FROM orders WHERE stage = 'quote'`, params: [] },
    { sql: `SELECT COUNT(*) AS n FROM (SELECT product_id FROM stock_moves GROUP BY product_id HAVING SUM(delta) <= 0)`, params: [] }
  ])).map(r => r.results || []);

  const pack = a => {
    const sales = round2(a.sales), cost = round2(a.cost), fees = round2(a.fee), margin = round2(sales - cost - fees);
    return { orders: a.n, sales, cost, fees, margin, marginPct: sales > 0 ? round2((margin / sales) * 100) : 0, outstanding: round2(a.outstanding) };
  };
  return {
    total: pack(all[0]), month: pack(month[0]),
    byStage: Object.fromEntries(stages.map(s => [s.stage, s.n])),
    byChannel: channels.map(c => ({ channel: c.channel, ...pack(c) })),
    quotes: { n: quotes[0].n, value: round2(quotes[0].value) },
    overdue: overdue[0].n, openTasks: tasks[0].n, outOfStock: stock[0].n,
    intake: !!(process.env.INTAKE_TOKEN || '').trim() && (process.env.INTAKE_TOKEN || '').trim().length >= 24
  };
}
