// lib/db.js — Cloudflare D1 por REST. Sin SDK, sin dependencias.
// D1 documenta `params` como string[]: TODO se envía como texto y SQLite aplica la afinidad de la columna
// (INTEGER/REAL convierten '249.5' solos). Regla de la casa: sin NULL; "vacío" = '' o 0.
// Cuotas gratis (Workers Free): 5 M filas leídas/día, 100 k escritas/día, 5 GB. Más que suficiente para un taller.

const API = 'https://api.cloudflare.com/client/v4/accounts';

export class DbError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail; // solo logs. El mensaje de SQLite puede traer nombres de tablas: no va al cliente.
  }
}

const clean = v => (v || '').trim().replace(/^["']+|["']+$/g, '').trim();

/** Credenciales de D1, o null. El token de D1 puede ser el mismo de Workers AI si le diste permiso D1:Edit. */
export function dbConfig() {
  const accountId = clean(process.env.CLOUDFLARE_ACCOUNT_ID);
  const databaseId = clean(process.env.CLOUDFLARE_D1_DATABASE_ID);
  const token = clean(process.env.CLOUDFLARE_D1_TOKEN) || clean(process.env.CLOUDFLARE_API_TOKEN);
  return accountId && databaseId && token ? { accountId, databaseId, token } : null;
}
export const dbReady = () => !!dbConfig();

const str = v => (v == null ? '' : String(v));

async function call(body) {
  const cfg = dbConfig();
  if (!cfg) throw new DbError('Base de datos no configurada', 503);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(`${API}/${cfg.accountId}/d1/database/${cfg.databaseId}/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.success === false) {
      const e = data.errors?.[0] || {};
      throw new DbError('Error de base de datos', r.status, `${e.code ?? ''} ${e.message ?? ''}`.trim());
    }
    return data.result || [];
  } catch (err) {
    if (err.name === 'AbortError') throw new DbError('La base de datos tardó demasiado', 504);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const stmt = (sql, params = []) => ({ sql, params: params.map(str) });

/** SELECT → array de objetos. */
export async function all(sql, params = []) {
  const [res] = await call(stmt(sql, params));
  return res?.results || [];
}
/** SELECT → primer objeto o null. */
export async function first(sql, params = []) {
  return (await all(sql, params))[0] ?? null;
}
/** INSERT/UPDATE/DELETE → meta ({ changes, last_row_id, … }). */
export async function run(sql, params = []) {
  const [res] = await call(stmt(sql, params));
  return res?.meta || {};
}
/** Varias sentencias en UNA transacción atómica y UN solo viaje de red. */
export async function batch(statements) {
  return call({ batch: statements.map(s => stmt(s.sql, s.params)) });
}
