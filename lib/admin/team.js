// lib/admin/team.js — Empleados y tareas de taller.
import { all, first, run, batch } from '../db.js';
import { TASK_STATUS, nowIso } from '../orders.js';
import { bad, notFound, int } from './http.js';

const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const date = v => { const s = String(v ?? '').trim(); if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw bad('Fecha no válida (AAAA-MM-DD)'); return s; };

// ---------------- Empleados ----------------
export async function employeesHandler({ method, query, body }) {
  const id = int(query.get('id'));

  if (method === 'GET') {
    return { employees: await all(`SELECT e.*, (SELECT COUNT(*) FROM tasks t WHERE t.employee_id = e.id AND t.status != 'done') AS open_tasks
                                     FROM employees e ORDER BY e.active DESC, e.name`) };
  }
  if (method === 'POST') {
    const name = txt(body?.name, 60);
    if (name.length < 2) throw bad('Falta el nombre del empleado');
    const m = await run('INSERT INTO employees (name, area, phone, active) VALUES (?, ?, ?, 1)', [name, txt(body?.area, 40), String(body?.phone ?? '').replace(/\D/g, '').slice(0, 15)]);
    return { id: m.last_row_id };
  }
  if (!id) throw bad('Falta el id');
  if (method === 'PUT') {
    if (!(await first('SELECT id FROM employees WHERE id = ?', [id]))) throw notFound('Empleado no encontrado');
    const sets = [], params = [];
    if ('name' in (body || {})) { const n = txt(body.name, 60); if (n.length < 2) throw bad('Falta el nombre del empleado'); sets.push('name = ?'); params.push(n); }
    if ('area' in (body || {})) { sets.push('area = ?'); params.push(txt(body.area, 40)); }
    if ('phone' in (body || {})) { sets.push('phone = ?'); params.push(String(body.phone ?? '').replace(/\D/g, '').slice(0, 15)); }
    if ('active' in (body || {})) { sets.push('active = ?'); params.push(body.active ? 1 : 0); }
    if (!sets.length) throw bad('No hay cambios que guardar');
    await run(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    return { ok: true };
  }
  if (method === 'DELETE') {
    await batch([ // sus tareas quedan "sin asignar", no huérfanas
      { sql: 'UPDATE tasks SET employee_id = 0 WHERE employee_id = ?', params: [id] },
      { sql: 'DELETE FROM employees WHERE id = ?', params: [id] }
    ]);
    return { ok: true };
  }
  throw bad('Método no permitido');
}

// ---------------- Tareas ----------------
async function checkRefs(folio, employeeId) {
  if (folio !== undefined && !(await first('SELECT folio FROM orders WHERE folio = ?', [folio]))) throw notFound('Esa orden no existe');
  if (employeeId && !(await first('SELECT id FROM employees WHERE id = ? AND active = 1', [employeeId]))) throw notFound('Ese empleado no existe o está inactivo');
}

export async function tasksHandler({ method, query, body }) {
  const id = int(query.get('id'));

  if (method === 'GET') {
    const where = [], params = [];
    if (query.get('folio')) { where.push('t.folio = ?'); params.push(query.get('folio').toUpperCase()); }
    if (int(query.get('employee_id'))) { where.push('t.employee_id = ?'); params.push(int(query.get('employee_id'))); }
    if (query.get('status') === 'open') where.push(`t.status != 'done'`);
    else if (TASK_STATUS.includes(query.get('status'))) { where.push('t.status = ?'); params.push(query.get('status')); }
    return { tasks: await all(
      `SELECT t.*, COALESCE(e.name, '') AS employee_name, COALESCE(o.title, '') AS order_title, COALESCE(o.customer_name, '') AS customer
         FROM tasks t LEFT JOIN employees e ON e.id = t.employee_id LEFT JOIN orders o ON o.folio = t.folio
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY (t.status = 'done'), (t.due_date = ''), t.due_date, t.id LIMIT 500`, params) };
  }
  if (method === 'POST') {
    const folio = String(body?.folio ?? '').trim().toUpperCase();
    const title = txt(body?.title, 120);
    if (title.length < 2) throw bad('Falta el título de la tarea');
    const emp = int(body?.employee_id);
    await checkRefs(folio, emp);
    const status = TASK_STATUS.includes(body?.status) ? body.status : 'todo';
    const m = await run('INSERT INTO tasks (folio, title, area, employee_id, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [folio, title, txt(body?.area, 40), emp, status, date(body?.due_date), nowIso()]);
    return { id: m.last_row_id };
  }
  if (!id) throw bad('Falta el id');
  if (method === 'PUT') {
    if (!(await first('SELECT id FROM tasks WHERE id = ?', [id]))) throw notFound('Tarea no encontrada');
    const b = body || {}, sets = [], params = [];
    if ('title' in b) { const t = txt(b.title, 120); if (t.length < 2) throw bad('Falta el título de la tarea'); sets.push('title = ?'); params.push(t); }
    if ('area' in b) { sets.push('area = ?'); params.push(txt(b.area, 40)); }
    if ('employee_id' in b) { const e = int(b.employee_id); await checkRefs(undefined, e); sets.push('employee_id = ?'); params.push(e); }
    if ('status' in b) { if (!TASK_STATUS.includes(b.status)) throw bad('Estado no válido'); sets.push('status = ?'); params.push(b.status); }
    if ('due_date' in b) { sets.push('due_date = ?'); params.push(date(b.due_date)); }
    if (!sets.length) throw bad('No hay cambios que guardar');
    await run(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    return { ok: true };
  }
  if (method === 'DELETE') { await run('DELETE FROM tasks WHERE id = ?', [id]); return { ok: true }; }
  throw bad('Método no permitido');
}
