// /api/admin?r=<recurso> — Router del panel privado (una sola función: Vercel Hobby limita cuántas puedes desplegar).
//   r=login (POST) · logout (POST) · session (GET) · init (POST) · stats · orders · products · employees · tasks
// Todo lo demás exige sesión (cookie firmada) y, en escrituras, la cabecera X-Requested-With: pc-admin.
import { dbReady, DbError, batch } from '../lib/db.js';
import { SCHEMA } from '../lib/schema.js';
import { authConfigured, checkPassword, sessionCookie, clearCookie, isAuthed, csrfOk } from '../lib/auth.js';
import { limited, failures, clientIp } from '../lib/limits.js';
import { HttpError } from '../lib/admin/http.js';
import { ValidationError } from '../lib/orders.js';
import { ordersHandler } from '../lib/admin/orders.js';
import { employeesHandler, tasksHandler } from '../lib/admin/team.js';
import { productsHandler, seedProducts } from '../lib/admin/products.js';
import { statsHandler } from '../lib/admin/stats.js';

const ROUTES = { orders: ordersHandler, employees: employeesHandler, tasks: tasksHandler, products: productsHandler, stats: statsHandler };
const sleep = ms => new Promise(ok => setTimeout(ok, ms));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const url = new URL(req.url || '/', 'http://x');
  const r = url.searchParams.get('r') || '';
  const ip = clientIp(req);
  const send = (code, body) => res.status(code).json(body);

  // --- Sesión ---
  if (r === 'session') {
    return send(200, { authed: isAuthed(req), configured: authConfigured(), db: dbReady() });
  }
  if (r === 'login') {
    if (req.method !== 'POST') return send(405, { error: 'Método no permitido' });
    if (!authConfigured()) return send(503, { error: 'Falta configurar ADMIN_PASSWORD en Vercel (mínimo 10 caracteres).' });
    if (!csrfOk(req)) return send(403, { error: 'Solicitud no permitida' });
    if (failures(`login:${ip}`) >= 5) return send(429, { error: 'Demasiados intentos. Espera 15 minutos.' });
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
    if (!checkPassword(b?.password)) {
      limited(`login:${ip}`, 1e9, 15 * 60_000); // registra el fallo
      await sleep(600);                          // frena la fuerza bruta aunque cambien de IP
      return send(401, { error: 'Contraseña incorrecta' });
    }
    res.setHeader('Set-Cookie', sessionCookie(req));
    return send(200, { ok: true });
  }
  if (r === 'logout') {
    res.setHeader('Set-Cookie', clearCookie(req));
    return send(200, { ok: true });
  }

  // --- Todo lo demás: autenticado ---
  if (!isAuthed(req)) return send(401, { error: 'Sesión vencida. Inicia sesión de nuevo.', code: 'auth' });
  if (!csrfOk(req)) return send(403, { error: 'Solicitud no permitida' });
  if (limited(`admin:${ip}`, 240)) return send(429, { error: 'Demasiadas solicitudes' });
  if (!dbReady()) return send(503, { error: 'La base de datos (D1) no está configurada en Vercel.', code: 'db' });

  try {
    if (r === 'init') {
      if (req.method !== 'POST') return send(405, { error: 'Método no permitido' });
      await batch(SCHEMA);
      return send(200, { ok: true, seeded: await seedProducts() });
    }
    const fn = ROUTES[r];
    if (!fn) return send(404, { error: 'Recurso desconocido' });
    let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    return send(200, await fn({ method: req.method, query: url.searchParams, body: body || {} }));
  } catch (err) {
    if (err instanceof HttpError) return send(err.status, { error: err.message, ...err.extra });
    if (err instanceof ValidationError) return send(400, { error: err.message });
    console.error('[admin]', r, err.constructor.name, err.status ?? '', err.detail ?? err.message);
    if (err instanceof DbError && /no such table/i.test(err.detail || '')) {
      return send(409, { error: 'Falta crear las tablas. Pulsa "Inicializar base de datos".', code: 'schema' });
    }
    return send(502, { error: 'Error de base de datos. Intenta de nuevo.' });
  }
}
