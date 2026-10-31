// lib/admin/stats.js — Panel de control: una sola ida a la base (batch) con todos los números.
import { batch } from '../db.js';
import { round2 } from '../orders.js';

export async function statsHandler() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const agg = `COUNT(*) AS n, COALESCE(SUM(price), 0) AS sales, COALESCE(SUM(cost), 0) AS cost, COALESCE(SUM(price - paid), 0) AS outstanding`;
  const [all, month, stages, overdue, tasks] = (await batch([
    { sql: `SELECT ${agg} FROM orders`, params: [] },
    { sql: `SELECT ${agg} FROM orders WHERE created_at >= ?`, params: [monthStart] },
    { sql: `SELECT stage, COUNT(*) AS n FROM orders GROUP BY stage`, params: [] },
    { sql: `SELECT COUNT(*) AS n FROM orders WHERE due_date != '' AND due_date < ? AND stage != 'delivered'`, params: [today] },
    { sql: `SELECT COUNT(*) AS n FROM tasks WHERE status != 'done'`, params: [] }
  ])).map(r => r.results || []);

  const pack = a => {
    const sales = round2(a.sales), cost = round2(a.cost), margin = round2(sales - cost);
    return { orders: a.n, sales, cost, margin, marginPct: sales > 0 ? round2((margin / sales) * 100) : 0, outstanding: round2(a.outstanding) };
  };
  const byStage = Object.fromEntries(stages.map(s => [s.stage, s.n]));
  return { total: pack(all[0]), month: pack(month[0]), byStage, overdue: overdue[0].n, openTasks: tasks[0].n };
}
