import { batch, run, DbError } from './db.js';

// lib/schema.js — Esquema de D1. Idempotente: se puede correr N veces (botón "Inicializar" del panel).
// Reglas: sin NULL (DEFAULT ''/0), fechas ISO en TEXT, dinero en REAL (pesos con centavos).

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS products (
     id   TEXT PRIMARY KEY,
     sort INTEGER NOT NULL DEFAULT 0,
     data TEXT NOT NULL                       -- JSON completo de la tarjeta: nada se pierde si agregas campos
   )`,
  `CREATE TABLE IF NOT EXISTS employees (
     id     INTEGER PRIMARY KEY AUTOINCREMENT,
     name   TEXT NOT NULL,
     area   TEXT NOT NULL DEFAULT '',
     phone  TEXT NOT NULL DEFAULT '',
     active INTEGER NOT NULL DEFAULT 1
   )`,
  `CREATE TABLE IF NOT EXISTS orders (
     folio         TEXT PRIMARY KEY,           -- PC-1001
     created_at    TEXT NOT NULL,
     updated_at    TEXT NOT NULL,
     customer_name TEXT NOT NULL DEFAULT '',
     phone         TEXT NOT NULL DEFAULT '',   -- solo dígitos
     customer_type TEXT NOT NULL DEFAULT 'Particular',
     channel       TEXT NOT NULL DEFAULT 'WhatsApp',
     title         TEXT NOT NULL DEFAULT '',   -- resumen visible al cliente
     items         TEXT NOT NULL DEFAULT '[]', -- JSON [{name, qty, specs}] visible al cliente
     specs         TEXT NOT NULL DEFAULT '',   -- ficha técnica INTERNA
     stage         TEXT NOT NULL DEFAULT 'approved',
     price         REAL NOT NULL DEFAULT 0,    -- venta
     cost          REAL NOT NULL DEFAULT 0,    -- costo proveedor + insumos (INTERNO)
     paid          REAL NOT NULL DEFAULT 0,    -- anticipo / pagado
     fee           REAL NOT NULL DEFAULT 0,    -- comisión del canal (marketplace): se resta de la utilidad
     ext_ref       TEXT NOT NULL DEFAULT '',   -- n.º de orden en Mercado Libre / Amazon / Facebook (evita duplicados)
     supplier      TEXT NOT NULL DEFAULT '',
     due_date      TEXT NOT NULL DEFAULT '',
     carrier       TEXT NOT NULL DEFAULT '',
     guide         TEXT NOT NULL DEFAULT '',
     track_url     TEXT NOT NULL DEFAULT '',
     ship_eta      TEXT NOT NULL DEFAULT '',
     notes         TEXT NOT NULL DEFAULT '',   -- INTERNAS
     public_note   TEXT NOT NULL DEFAULT ''    -- mensaje visible al cliente
   )`,
  `CREATE TABLE IF NOT EXISTS order_events (
     id    INTEGER PRIMARY KEY AUTOINCREMENT,
     folio TEXT NOT NULL,
     at    TEXT NOT NULL,
     stage TEXT NOT NULL,
     note  TEXT NOT NULL DEFAULT ''
   )`,
  `CREATE TABLE IF NOT EXISTS tasks (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     folio       TEXT NOT NULL,
     title       TEXT NOT NULL,
     area        TEXT NOT NULL DEFAULT '',
     employee_id INTEGER NOT NULL DEFAULT 0,   -- 0 = sin asignar
     status      TEXT NOT NULL DEFAULT 'todo', -- todo | doing | done
     due_date    TEXT NOT NULL DEFAULT '',
     created_at  TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS listings (       -- producto ↔ publicación en un marketplace
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     product_id TEXT NOT NULL,
     channel    TEXT NOT NULL,
     ext_id     TEXT NOT NULL DEFAULT '',     -- MLM123…, ASIN, id de la publicación
     url        TEXT NOT NULL DEFAULT '',
     price      REAL NOT NULL DEFAULT 0,      -- precio publicado en ese canal
     buffer     INTEGER NOT NULL DEFAULT 0,   -- piezas que NO se publican (reserva para la tienda propia)
     status     TEXT NOT NULL DEFAULT 'active',
     updated_at TEXT NOT NULL,
     UNIQUE (product_id, channel)
   )`,
  `CREATE TABLE IF NOT EXISTS stock_moves (    -- inventario como libro de movimientos: stock = SUM(delta). Auditable y sin carreras
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     product_id TEXT NOT NULL,
     delta      INTEGER NOT NULL,
     reason     TEXT NOT NULL DEFAULT '',     -- 'ajuste' | 'order'
     folio      TEXT NOT NULL DEFAULT '',
     at         TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_moves_product  ON stock_moves(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_moves_folio    ON stock_moves(folio)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_stage   ON orders(stage)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_updated ON orders(updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_events_folio   ON order_events(folio)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_folio    ON tasks(folio)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_emp      ON tasks(employee_id, status)`
].map(sql => ({ sql, params: [] }));

/** Columnas nuevas para bases YA creadas (CREATE TABLE IF NOT EXISTS no altera tablas existentes). */
const MIGRATIONS = [
  `ALTER TABLE orders ADD COLUMN fee REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN ext_ref TEXT NOT NULL DEFAULT ''`
];
/** Índices que dependen de columnas migradas: van DESPUÉS de las migraciones. */
const AFTER = [{ sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_ext ON orders(channel, ext_ref) WHERE ext_ref != ''`, params: [] }];


/** Idempotente: crea tablas, migra columnas y crea índices. Seguro de repetir. */
export async function initDatabase() {
  await batch(SCHEMA);
  for (const sql of MIGRATIONS) {
    try { await run(sql); }
    catch (e) { if (!(e instanceof DbError) || !/duplicate column/i.test(e.detail || '')) throw e; } // ya existía: nada que migrar
  }
  await batch(AFTER);
}
