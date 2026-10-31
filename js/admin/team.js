// js/admin/team.js — Equipo y tareas de taller: quién hace qué, para cuándo.
import { api } from './api.js';
import { el, field, select, fdate, toast, modal, confirmBox, badge } from './ui.js';
import { openOrder } from './orders.js';

const TASK_STATUS = [['todo', 'Por hacer'], ['doing', 'En proceso'], ['done', 'Hecha']];
const state = { emp: 'all' };

export async function renderTeam(root) {
  const left = el('div', { class: 'adm-panel' }), right = el('div', { class: 'adm-panel' });
  root.replaceChildren(el('div', { class: 'adm-toolbar' }, el('h1', {}, 'Equipo y tareas')), el('div', { class: 'adm-two' }, left, right));
  let emps = [];

  async function load() {
    emps = (await api('employees')).employees;
    drawEmployees();
    await loadTasks();
  }

  // ---------- Empleados ----------
  function drawEmployees() {
    const name = el('input', { type: 'text', placeholder: 'Nombre', maxlength: '60', 'aria-label': 'Nombre' });
    const area = el('input', { type: 'text', placeholder: 'Área (Serigrafía, 3D, Láser…)', maxlength: '40', 'aria-label': 'Área' });
    const add = async () => {
      try { await api('employees', { method: 'POST', body: { name: name.value, area: area.value } }); toast('Empleado agregado'); await load(); }
      catch (e) { toast(e.message); }
    };
    name.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    left.replaceChildren(el('h2', {}, 'Empleados'),
      el('div', { class: 'adm-inline' }, name, area, el('button', { class: 'btn red', type: 'button', onclick: add }, 'Agregar')),
      emps.length ? el('ul', { class: 'adm-list' }, emps.map(e => el('li', { class: e.active ? '' : 'off' },
        el('div', {}, el('strong', {}, e.name), el('small', {}, [e.area, e.phone].filter(Boolean).join(' · ') || 'Sin área'), badge(`${e.open_tasks} abierta${e.open_tasks === 1 ? '' : 's'}`, e.open_tasks ? 'low' : '')),
        el('div', { class: 'adm-row-actions' },
          el('button', { class: 'btn', type: 'button', onclick: () => editEmployee(e) }, 'Editar'),
          el('button', { class: 'btn', type: 'button', onclick: async () => { try { await api('employees', { method: 'PUT', query: { id: e.id }, body: { active: !e.active } }); await load(); } catch (x) { toast(x.message); } } }, e.active ? 'Desactivar' : 'Activar'),
          el('button', { class: 'btn danger', type: 'button', onclick: async () => {
            if (!(await confirmBox(`¿Eliminar a ${e.name}? Sus tareas quedarán sin asignar.`, { ok: 'Eliminar', danger: true }))) return;
            try { await api('employees', { method: 'DELETE', query: { id: e.id } }); await load(); } catch (x) { toast(x.message); }
          } }, 'Eliminar')))))
        : el('p', { class: 'adm-empty' }, 'Aún no hay empleados. Agrega al primero arriba.'));
  }

  function editEmployee(e) {
    const m = modal('Editar empleado');
    const n = el('input', { type: 'text', value: e.name, maxlength: '60' }), a = el('input', { type: 'text', value: e.area, maxlength: '40' }), p = el('input', { type: 'tel', value: e.phone });
    m.body.append(el('div', { class: 'adm-grid' }, field('Nombre', n), field('Área', a), field('Teléfono', p)),
      el('div', { class: 'adm-actions' }, el('button', { class: 'btn red', type: 'button', onclick: async () => {
        try { await api('employees', { method: 'PUT', query: { id: e.id }, body: { name: n.value, area: a.value, phone: p.value } }); m.close(); await load(); } catch (x) { toast(x.message); }
      } }, 'Guardar')));
  }

  // ---------- Tareas ----------
  async function loadTasks() {
    const query = { status: 'open' };
    if (state.emp !== 'all' && state.emp !== '0') query.employee_id = state.emp;
    let { tasks } = await api('tasks', { query });
    if (state.emp === '0') tasks = tasks.filter(t => !t.employee_id);

    const active = emps.filter(e => e.active);
    const filter = select([['all', 'Todo el equipo'], ['0', 'Sin asignar'], ...active.map(e => [String(e.id), e.name])], state.emp, { 'aria-label': 'Filtrar por empleado' });
    filter.addEventListener('change', () => { state.emp = filter.value; loadTasks().catch(x => toast(x.message)); });
    const empOpts = [['0', 'Sin asignar'], ...active.map(e => [String(e.id), e.name])];
    const upd = (id, body) => api('tasks', { method: 'PUT', query: { id }, body }).then(loadTasks).then(() => load().catch(() => {})).catch(x => toast(x.message));

    right.replaceChildren(el('div', { class: 'adm-toolbar tight' }, el('h2', {}, 'Tareas abiertas'), filter,
      el('button', { class: 'btn red', type: 'button', onclick: () => newTask() }, '+ Nueva tarea')),
      tasks.length ? el('div', { class: 'adm-tasks' }, tasks.map(t => el('div', { class: `adm-task ${t.status}` },
        select(TASK_STATUS, t.status, { 'aria-label': 'Estado', onchange: e => upd(t.id, { status: e.target.value }) }),
        el('span', { class: 'adm-task-title' }, t.title,
          el('small', {}, el('a', { href: '#', onclick: e => { e.preventDefault(); openOrder(t.folio, { onSaved: loadTasks }); } }, t.folio), ` · ${t.customer}`)),
        select(empOpts, String(t.employee_id), { 'aria-label': 'Responsable', onchange: e => upd(t.id, { employee_id: e.target.value }) }),
        el('span', { class: t.due_date && t.due_date < new Date().toISOString().slice(0, 10) ? 'neg' : '' }, fdate(t.due_date)))))
        : el('p', { class: 'adm-empty' }, 'Sin tareas abiertas. Las tareas se crean dentro de cada orden o con «+ Nueva tarea».'));
  }

  async function newTask() {
    let orders;
    try { orders = (await api('orders', { query: { stage: 'active' } })).orders; } catch (e) { return toast(e.message); }
    if (!orders.length) return toast('Primero crea una orden activa para asignarle tareas.');
    const m = modal('Nueva tarea');
    const folio = select(orders.map(o => [o.folio, `${o.folio} · ${o.customer_name} · ${o.title}`.slice(0, 70)]));
    const title = el('input', { type: 'text', maxlength: '120', placeholder: 'Ej. Preparar pantallas de serigrafía' });
    const emp = select([['0', 'Sin asignar'], ...emps.filter(e => e.active).map(e => [String(e.id), e.name])]);
    const due = el('input', { type: 'date' });
    m.body.append(el('div', { class: 'adm-grid' }, field('Orden', folio, 'span2'), field('Tarea', title, 'span2'), field('Responsable', emp), field('Fecha límite', due)),
      el('div', { class: 'adm-actions' }, el('button', { class: 'btn red', type: 'button', onclick: async () => {
        try { await api('tasks', { method: 'POST', body: { folio: folio.value, title: title.value, employee_id: emp.value, due_date: due.value } }); m.close(); toast('Tarea creada'); await load(); }
        catch (e) { toast(e.message); }
      } }, 'Crear tarea')));
  }

  await load();
}
