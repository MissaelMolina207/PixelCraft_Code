// lib/admin/orders.js — CRUD de órdenes. Cada cambio de etapa deja un evento con fecha (alimenta el timeline público).
import { all, first, batch, DbError } from '../db.js';
import { cleanOrder, cleanFolio, STAGE_KEYS, money_, nowIso, isOverdue, trackingUrl } from '../orders.js';
import { bad, notFound, conflict, parseJSON } from './http.js';

const DEFAULTS = {
  customer_type: 'Particular', channel: 'WhatsApp', items: '[]', specs: '', stage: 'approved', price: 0, cost: 0, paid: 0,
  supplier: '', due_date: '', carrier: '', guide: '', track_url: '', ship_eta: '', notes: '', public_note: ''
};

/** Orden de BD → orden para el panel (items ya parseado + dinero calculado). */
const view = o => ({ ...o, items: parseJSON(o.items, []), ...money_(o), overdue: isOverdue(o), trackingUrl: trackingUrl(o) });

async function nextFolio() {
  const last = await first(`SELECT folio FROM orders WHERE folio GLOB 'PC-[0-9]*' ORDER BY CAST(SUBSTR(folio, 4) AS INTEGER) DESC LIMIT 1`);
  return `PC-${last ? parseInt(last.folio.slice(3), 10) + 1 : 1001}`;
}

const eventStmt = (folio, stage, note = '') => ({
  sql: 'INSERT INTO order_events (folio, at, stage, note) VALUES (?, ?, ?, ?)', params: [folio, nowIso(), stage, note]
});

export async function ordersHandler({ method, query, body }) {
  const folio = (query.get('folio') || '').trim().toUpperCase();

  if (method === 'GET') {
    if (folio) {
      const o = await first('SELECT * FROM orders WHERE folio = ?', [folio]);
      if (!o) throw notFound('Orden no encontrada');
      const [events, tasks] = await Promise.all([
        all('SELECT id, stage, at, note FROM order_events WHERE folio = ? ORDER BY id', [folio]),
        all(`SELECT t.*, COALESCE(e.name, '') AS employee_name FROM tasks t LEFT JOIN employees e ON e.id = t.employee_id WHERE t.folio = ? ORDER BY t.id`, [folio])
      ]);
      return { order: view(o), events, tasks };
    }
    const where = [], params = [];
    const stage = query.get('stage') || '';
    if (stage === 'active') where.push(`stage != 'delivered'`);
    else if (STAGE_KEYS.includes(stage)) { where.push('stage = ?'); params.push(stage); }
    const q = (query.get('q') || '').trim().toLowerCase().replace(/[%_]/g, '').slice(0, 40);
    if (q) {
      where.push(`(lower(folio) LIKE ? OR lower(customer_name) LIKE ? OR phone LIKE ? OR lower(title) LIKE ? OR lower(guide) LIKE ?)`);
      params.push(...Array(5).fill(`%${q}%`));
    }
    const [orders, load] = await Promise.all([
      all(`SELECT * FROM orders ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY updated_at DESC LIMIT 300`, params),
      all(`SELECT t.folio, t.employee_id, COALESCE(e.name, '') AS name, COUNT(*) AS n
             FROM tasks t LEFT JOIN employees e ON e.id = t.employee_id
            WHERE t.status != 'done' GROUP BY t.folio, t.employee_id`)
    ]);
    const byFolio = {};
    for (const l of load) (byFolio[l.folio] ||= []).push(l);
    return { orders: orders.map(o => ({ ...view(o), openTasks: (byFolio[o.folio] || []).reduce((s, l) => s + l.n, 0), assignees: [...new Set((byFolio[o.folio] || []).map(l => l.name).filter(Boolean))] })) };
  }

  if (method === 'POST') {
    const { data } = cleanOrder(body, { create: true });
    const row = { ...DEFAULTS, ...data };
    const cols = Object.keys(row);
    const attempt = async f => {
      const now = nowIso();
      await batch([
        { sql: `INSERT INTO orders (folio, created_at, updated_at, ${cols.join(', ')}) VALUES (?, ?, ?, ${cols.map(() => '?').join(', ')})`, params: [f, now, now, ...cols.map(c => row[c])] },
        eventStmt(f, row.stage, 'Orden creada')
      ]);
      return f;
    };
    const wanted = body?.folio ? cleanFolio(body.folio) : null;
    try {
      return { folio: await attempt(wanted || await nextFolio()) };
    } catch (err) {
      if (!(err instanceof DbError) || !/UNIQUE|constraint/i.test(err.detail || '')) throw err;
      if (wanted) throw conflict('Ese folio ya existe');
      return { folio: await attempt(await nextFolio()) }; // carrera entre dos altas simultáneas: reintento único
    }
  }

  if (!folio) throw bad('Falta el folio');

  if (method === 'PUT') {
    const cur = await first('SELECT * FROM orders WHERE folio = ?', [folio]);
    if (!cur) throw notFound('Orden no encontrada');
    const { data } = cleanOrder(body);
    const keys = Object.keys(data); // ya viene de la whitelist de ORDER_FIELDS: seguro para armar el SET
    if (!keys.length) throw bad('No hay cambios que guardar');
    const stmts = [{ sql: `UPDATE orders SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE folio = ?`, params: [...keys.map(k => data[k]), nowIso(), folio] }];
    if (data.stage && data.stage !== cur.stage) stmts.push(eventStmt(folio, data.stage, String(body?.event_note || '').slice(0, 200)));
    await batch(stmts);
    return { ok: true };
  }

  if (method === 'DELETE') {
    const cur = await first('SELECT folio FROM orders WHERE folio = ?', [folio]);
    if (!cur) throw notFound('Orden no encontrada');
    await batch([
      { sql: 'DELETE FROM tasks WHERE folio = ?', params: [folio] },
      { sql: 'DELETE FROM order_events WHERE folio = ?', params: [folio] },
      { sql: 'DELETE FROM orders WHERE folio = ?', params: [folio] }
    ]);
    return { ok: true };
  }
  throw bad('Método no permitido');
}
