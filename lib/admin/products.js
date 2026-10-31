// lib/admin/products.js — Catálogo editable. La tarjeta completa vive como JSON en `data`: agregar un campo nuevo
// al sitio no exige migrar la tabla. Validación estricta: lo que guardas aquí se pinta en el sitio y lo cobra Stripe.
import { all, first, run, batch } from '../db.js';
import { readData } from '../catalog.js';
import { bad, notFound, conflict, parseJSON } from './http.js';

const CATS = ['3d', 'screen', 'cut', 'promo', 'ia'];
const SECTORS = ['', 'textil', 'promocionales', 'publicidad'];
const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/** Imagen: ruta relativa dentro del sitio (img/…) o https. Nada de javascript:, data: ni rutas con "..". */
function img(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^https:\/\/[^\s"'<>]+$/.test(s)) return s.slice(0, 400);
  if (/^img\/[A-Za-z0-9._\-\/]+$/.test(s) && !s.includes('..')) return s;
  throw bad('Imagen no válida: usa una ruta como img/producto.jpg o un enlace https://');
}

/** Normaliza una tarjeta. Solo incluye los campos opcionales que traen valor (el JSON queda limpio). */
export function cleanProduct(b, id) {
  const name = txt(b?.name, 80);
  if (name.length < 2) throw bad('Falta el nombre del producto');
  const price = Number(b?.price);
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000) throw bad('Precio no válido');
  const cat = b?.cat || 'promo';
  if (!CATS.includes(cat)) throw bad('Categoría interna no válida');
  const categoria = b?.categoria || '';
  if (!SECTORS.includes(categoria)) throw bad('Sector no válido');
  const sub = String(b?.subcategoria ?? '').trim();
  if (sub && !/^[a-z0-9-]{1,40}$/.test(sub)) throw bad('Subcategoría no válida');

  const p = { id, name, cat, price: Math.round(price * 100) / 100 };
  const opt = { tag: txt(b?.tag, 12), unit: txt(b?.unit, 30), categoria, subcategoria: sub, img: img(b?.img), specs: txt(b?.specs, 400) };
  for (const [k, v] of Object.entries(opt)) if (v) p[k] = v;
  if (b?.hidden === true || b?.hidden === 'true') p.hidden = true;
  return p;
}

/** Sector/subsector sugeridos para los productos que ya tienes, para que los filtros del catálogo funcionen. */
const DEFAULT_SECTOR = {
  'llavero-3d': ['promocionales', 'llaveros-encendedores'], 'prototipo-resina': ['publicidad', 'promocionales'],
  'playera-1t': ['textil', 'playeras-camisas'], 'tote-2t': ['promocionales', 'bolsas-ecologicas'],
  'letrero-3d': ['publicidad', 'senaletica'], 'corte-laser': ['publicidad', 'corte-laser'],
  'stickers-50': ['publicidad', 'etiquetas'], 'kit-promo': ['promocionales', 'cristaleria-tazas']
};

/** Siembra products.json en D1 SOLO si la tabla está vacía. Devuelve cuántos insertó. */
export async function seedProducts() {
  const [{ n }] = await all('SELECT COUNT(*) AS n FROM products');
  if (n > 0) return 0;
  const list = readData('products.json').map((p, i) => {
    const [categoria, subcategoria] = DEFAULT_SECTOR[p.id] || [];
    return { ...p, ...(p.categoria || !categoria ? {} : { categoria, subcategoria }) };
  });
  await batch(list.map((p, i) => ({ sql: 'INSERT OR IGNORE INTO products (id, sort, data) VALUES (?, ?, ?)', params: [p.id, (i + 1) * 10, JSON.stringify(p)] })));
  return list.length;
}

export async function productsHandler({ method, query, body }) {
  const id = String(query.get('id') || '').trim();

  if (method === 'GET') {
    const rows = await all('SELECT data FROM products ORDER BY sort, rowid');
    return { products: rows.map(r => parseJSON(r.data, null)).filter(Boolean) };
  }
  if (method === 'POST') {
    const newId = slug(body?.id || body?.name);
    if (newId.length < 2) throw bad('No pude generar un id válido para este producto');
    if (await first('SELECT id FROM products WHERE id = ?', [newId])) throw conflict('Ya existe un producto con ese id');
    const p = cleanProduct(body, newId);
    await run(`INSERT INTO products (id, sort, data) VALUES (?, (SELECT COALESCE(MAX(sort), 0) + 10 FROM products), ?)`, [newId, JSON.stringify(p)]);
    return { id: newId };
  }
  if (!id) throw bad('Falta el id');
  if (method === 'PUT') {
    if (!(await first('SELECT id FROM products WHERE id = ?', [id]))) throw notFound('Producto no encontrado');
    await run('UPDATE products SET data = ? WHERE id = ?', [JSON.stringify(cleanProduct(body, id)), id]);
    return { ok: true };
  }
  if (method === 'DELETE') { await run('DELETE FROM products WHERE id = ?', [id]); return { ok: true }; }
  throw bad('Método no permitido');
}
