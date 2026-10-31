// lib/catalog.js — Catálogo: D1 si hay datos; si no, data/products.json. Lo usan /api/products y /api/checkout,
// así el precio que cobra Stripe es SIEMPRE el que editaste en el panel.
// Ojo: si borras TODOS los productos en el panel, el sitio vuelve a mostrar products.json (tabla vacía = sin sembrar).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dbReady, all } from './db.js';

export const readData = f => JSON.parse(readFileSync(join(process.cwd(), 'data', f), 'utf8'));

export async function loadCatalog() {
  if (dbReady()) {
    try {
      const rows = await all('SELECT data FROM products ORDER BY sort, rowid');
      if (rows.length) return { products: rows.map(r => JSON.parse(r.data)), source: 'd1' };
    } catch (err) {
      console.error('[catalog] D1 no respondió, uso products.json:', err.status ?? '', err.detail ?? err.message);
    }
  }
  return { products: readData('products.json'), source: 'json' };
}
