// lib/admin/channels.js — Canales de venta: inventario general + publicaciones (listings) en marketplaces.
// PixelCraft es la FUENTE DE VERDAD del stock. El empuje hacia Mercado Libre/Amazon/Facebook lo hace n8n leyendo
// /api/channels?op=stock (ver api/channels.js): aquí solo se mapea y se calcula cuánto publicar por canal.
import { all, first, run } from '../db.js';
import { MARKETPLACES, nowIso, round2 } from '../orders.js';
import { bad, notFound, conflict, parseJSON, int } from './http.js';
import { stockLevels } from './stock.js';

const STATUS = ['active', 'paused', 'draft'];
const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

async function productExists(id) {
  const r = await first('SELECT id FROM products WHERE id = ?', [id]);
  if (!r) throw notFound('Ese producto no existe en el catálogo');
}

/** Vista de inventario: cada producto con su stock y sus publicaciones por canal. */
export async function inventoryHandler({ method, body }) {
  if (method === 'GET') {
    const [prods, levels, listings] = await Promise.all([
      all('SELECT data FROM products ORDER BY sort, rowid'), stockLevels(), all('SELECT * FROM listings ORDER BY product_id, channel')
    ]);
    return {
      products: prods.map(r => parseJSON(r.data, null)).filter(Boolean).map(p => {
        const stock = p.id in levels ? levels[p.id] : null; // null = sin control de inventario
        return {
          id: p.id, name: p.name, price: p.price, hidden: !!p.hidden, stock,
          listings: listings.filter(l => l.product_id === p.id).map(l => ({ ...l, available: stock == null ? null : Math.max(0, stock - l.buffer) }))
        };
      })
    };
  }
  if (method === 'POST') { // ajuste manual: { product_id, delta } o { product_id, set }
    const id = txt(body?.product_id, 40);
    await productExists(id);
    const cur = (await stockLevels())[id];
    let delta;
    if ('set' in (body || {})) {
      const n = parseInt(body.set, 10);
      if (!Number.isInteger(n) || n < 0 || n > 1e7) throw bad('Stock no válido');
      delta = n - (cur ?? 0);
    } else {
      delta = parseInt(body?.delta, 10);
      if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1e7) throw bad('Ajuste no válido');
      if ((cur ?? 0) + delta < 0) throw bad('El stock no puede quedar negativo');
    }
    // 'set' al mismo valor de un producto SIN control inicia el control con un movimiento en 0
    await run(`INSERT INTO stock_moves (product_id, delta, reason, folio, at) VALUES (?, ?, 'ajuste', '', ?)`, [id, delta, nowIso()]);
    return { stock: (cur ?? 0) + delta };
  }
  throw bad('Método no permitido');
}

function cleanListing(b, { create }) {
  const d = {};
  if (create || 'channel' in b) { if (!MARKETPLACES.includes(b.channel)) throw bad('Canal no válido'); d.channel = b.channel; }
  if ('ext_id' in b) d.ext_id = txt(b.ext_id, 60);
  if ('url' in b) {
    const u = String(b.url ?? '').trim();
    if (u) { let x; try { x = new URL(u); } catch { throw bad('Enlace no válido'); } if (x.protocol !== 'https:') throw bad('El enlace debe empezar con https://'); }
    d.url = u.slice(0, 400);
  }
  if ('price' in b) { const n = Number(b.price); if (!Number.isFinite(n) || n < 0 || n > 1e7) throw bad('Precio no válido'); d.price = round2(n); }
  if ('buffer' in b) { const n = parseInt(b.buffer, 10); if (!Number.isInteger(n) || n < 0 || n > 9999) throw bad('Reserva no válida'); d.buffer = n; }
  if ('status' in b) { if (!STATUS.includes(b.status)) throw bad('Estado no válido'); d.status = b.status; }
  return d;
}

export async function listingsHandler({ method, query, body }) {
  const id = int(query.get('id'));
  const b = body || {};
  if (method === 'GET') return { listings: await all('SELECT * FROM listings ORDER BY product_id, channel') };
  if (method === 'POST') {
    const pid = txt(b.product_id, 40);
    await productExists(pid);
    const d = cleanListing(b, { create: true });
    if (await first('SELECT id FROM listings WHERE product_id = ? AND channel = ?', [pid, d.channel])) throw conflict('Ese producto ya está mapeado en ese canal');
    const m = await run('INSERT INTO listings (product_id, channel, ext_id, url, price, buffer, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [pid, d.channel, d.ext_id || '', d.url || '', d.price ?? 0, d.buffer ?? 0, d.status || 'active', nowIso()]);
    return { id: m.last_row_id };
  }
  if (!id) throw bad('Falta el id');
  if (method === 'PUT') {
    if (!(await first('SELECT id FROM listings WHERE id = ?', [id]))) throw notFound('Publicación no encontrada');
    const d = cleanListing(b, { create: false });
    delete d.channel; // el canal no cambia: se borra y se crea otra
    const keys = Object.keys(d);
    if (!keys.length) throw bad('No hay cambios que guardar');
    await run(`UPDATE listings SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [...keys.map(k => d[k]), nowIso(), id]);
    return { ok: true };
  }
  if (method === 'DELETE') { await run('DELETE FROM listings WHERE id = ?', [id]); return { ok: true }; }
  throw bad('Método no permitido');
}
