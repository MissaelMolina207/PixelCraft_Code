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
  `CREATE INDEX IF NOT EXISTS idx_orders_stage   ON orders(stage)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_updated ON orders(updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_events_folio   ON order_events(folio)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_folio    ON tasks(folio)`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_emp      ON tasks(employee_id, status)`
].map(sql => ({ sql, params: [] }));
