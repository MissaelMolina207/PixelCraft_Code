// js/admin/main.js — Arranque del panel: sesión, login, navegación por hash y manejo de "faltan tablas / falta la base".
import { api, newEpoch } from './api.js';
import { $, el, toast } from './ui.js';
import { renderDashboard } from './dashboard.js';
import { renderOrders } from './orders.js';
import { renderBoard } from './board.js';
import { renderTeam } from './team.js';
import { renderProducts } from './products.js';

const VIEWS = { panel: renderDashboard, orders: renderOrders, board: renderBoard, team: renderTeam, products: renderProducts };
const login = $('#login'), app = $('#app'), view = $('#view');

function show(authed, msg = '') {
  newEpoch(); // cada cambio de sesión invalida las peticiones que seguían en vuelo
  login.hidden = authed;
  app.hidden = !authed;
  if (!authed) {
    $('#loginErr').textContent = msg;
    $('#loginErr').hidden = !msg;
    $('#pw').value = '';
    $('#pw').focus();
  }
}

/** Estados vacíos accionables: en vez de un error críptico, te dicen exactamente qué falta. */
function problem(e) {
  if (e.code === 'schema') {
    return el('div', { class: 'adm-panel adm-setup' }, el('h2', {}, 'Falta crear las tablas'),
      el('p', {}, 'La base de datos está conectada pero vacía. Un clic crea las tablas y carga tu catálogo actual (products.json). Es seguro repetirlo.'),
      el('button', { class: 'btn red', type: 'button', onclick: async ev => {
        const btn = ev.currentTarget; // se captura antes del await (después es null)
        btn.disabled = true;
        try { const r = await api('init', { method: 'POST' }); toast(r.seeded ? `Listo. ${r.seeded} productos cargados.` : 'Listo. Las tablas ya existían.'); route(); }
        catch (x) { toast(x.message); btn.disabled = false; }
      } }, 'Inicializar base de datos'));
  }
  if (e.code === 'db') {
    return el('div', { class: 'adm-panel adm-setup' }, el('h2', {}, 'La base de datos no está configurada'),
      el('p', {}, 'En Vercel (Settings → Environment Variables) faltan CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID y CLOUDFLARE_D1_TOKEN. Después haz Redeploy.'));
  }
  return el('div', { class: 'adm-panel adm-setup' }, el('h2', {}, 'No se pudo cargar'), el('p', {}, e.message), el('button', { class: 'btn', type: 'button', onclick: () => route() }, 'Reintentar'));
}

let seq = 0; // evita que una vista lenta pise a la siguiente si cambias de pestaña rápido
async function route() {
  if (app.hidden) return; // en la pantalla de login no se cargan vistas (evita 401 fantasma)
  const name = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'panel';
  document.querySelectorAll('#tabs a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === `#${name}` ? 'page' : 'false'));
  const mine = ++seq;
  view.replaceChildren(el('p', { class: 'adm-empty' }, 'Cargando…'));
  try {
    const tmp = el('div');
    await VIEWS[name](tmp);
    if (mine === seq) view.replaceChildren(...tmp.childNodes);
  } catch (e) {
    if (mine === seq && e.status !== 401) view.replaceChildren(problem(e));
  }
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#loginBtn');
  btn.disabled = true;
  try { await api('login', { method: 'POST', body: { password: $('#pw').value } }); show(true); route(); }
  catch (x) { show(false, x.message); }
  finally { btn.disabled = false; }
});
$('#logout').addEventListener('click', async () => { await api('logout', { method: 'POST' }).catch(() => {}); show(false); });
document.addEventListener('admin:expired', () => show(false, 'Tu sesión venció. Entra de nuevo.'));
window.addEventListener('hashchange', route);

try {
  const s = await api('session');
  if (s.authed) { show(true); route(); }
  else show(false, s.configured ? '' : 'Falta configurar ADMIN_PASSWORD en Vercel (mínimo 10 caracteres) y hacer Redeploy.');
} catch {
  show(false, 'No hay conexión con el servidor. El panel solo funciona en el sitio publicado (o con "vercel dev").');
}
