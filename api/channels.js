// /api/channels — Puerta para n8n (u otro automatizador). Auth: Authorization: Bearer <INTAKE_TOKEN> (≥ 24 caracteres).
//   POST  → registra una orden venida de Mercado Libre / Amazon / Facebook Marketplace. Idempotente por (channel, ext_ref):
//           si n8n reintenta, no se duplica. Descuenta inventario solo (si las partidas traen `sku`).
//   GET ?op=stock[&channel=Mercado Libre] → cuánto publicar por producto y canal (stock − reserva). n8n lo empuja al marketplace.
// PixelCraft no llama a las APIs de los marketplaces (requieren OAuth de cada cuenta): n8n sí, usando estos dos endpoints.
import { timingSafeEqual, createHash } from 'node:crypto';
import { dbReady, first, all, DbError } from '../lib/db.js';
import { MARKETPLACES, ValidationError } from '../lib/orders.js';
import { createOrder } from '../lib/admin/orders.js';
import { HttpError } from '../lib/admin/http.js';
import { stockLevels } from '../lib/admin/stock.js';
import { limited, clientIp } from '../lib/limits.js';

const sha = s => createHash('sha256').update(String(s)).digest();

function authed(req) {
  const want = (process.env.INTAKE_TOKEN || '').trim();
  if (want.length < 24) return null; // sin token fuerte configurado, la puerta está cerrada
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return timingSafeEqual(sha(got), sha(want));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const a = authed(req);
  if (a === null) return res.status(503).json({ error: 'INTAKE_TOKEN no configurado (mínimo 24 caracteres)' });
  if (limited(`channels:${clientIp(req)}`, 120)) return res.status(429).json({ error: 'Demasiadas solicitudes' });
  if (!a) return res.status(401).json({ error: 'Token inválido' });
  if (!dbReady()) return res.status(503).json({ error: 'Base de datos no configurada' });

  try {
    if (req.method === 'GET') {
      if (new URL(req.url || '/', 'http://x').searchParams.get('op') !== 'stock') return res.status(400).json({ error: 'Usa ?op=stock' });
      const channel = new URL(req.url, 'http://x').searchParams.get('channel');
      const [rows, levels, prods] = await Promise.all([
        all('SELECT * FROM listings ORDER BY product_id, channel'), stockLevels(), all('SELECT data FROM products')
      ]);
      const names = Object.fromEntries(prods.map(r => { try { const p = JSON.parse(r.data); return [p.id, p.name]; } catch { return [null, null]; } }));
      return res.status(200).json({
        listings: rows.filter(l => !channel || l.channel === channel).map(l => {
          const stock = l.product_id in levels ? levels[l.product_id] : null;
          return { channel: l.channel, product_id: l.product_id, name: names[l.product_id] || '', ext_id: l.ext_id, status: l.status, price: l.price,
            stock, available: stock == null ? null : Math.max(0, stock - l.buffer) };
        })
      });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
    if (!MARKETPLACES.includes(b?.channel)) return res.status(400).json({ error: `channel debe ser uno de: ${MARKETPLACES.join(', ')}` });
    const ext = String(b.ext_ref ?? '').trim();
    if (!ext) return res.status(400).json({ error: 'Falta ext_ref (número de orden en el marketplace)' });

    const dup = await first('SELECT folio FROM orders WHERE channel = ? AND ext_ref = ?', [b.channel, ext]);
    if (dup) return res.status(200).json({ folio: dup.folio, duplicate: true });

    const folio = await createOrder({
      stage: 'approved', // las ventas de marketplace ya están pagadas: entran a "Por asignar"
      customer_name: b.customer_name || `Cliente ${b.channel}`, title: b.title || `Orden ${b.channel} ${ext}`,
      ...b, ext_ref: ext, paid: b.paid ?? b.price ?? 0, // salvo que n8n diga otra cosa, el marketplace ya cobró
      notes: [b.notes, 'Entrada automática (n8n)'].filter(Boolean).join(' · ')
    }, { eventNote: `Entrada desde ${b.channel}` });
    return res.status(200).json({ folio, duplicate: false });
  } catch (err) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    console.error('[channels]', err.constructor.name, err.status ?? '', err.detail ?? err.message);
    return res.status(502).json({ error: 'Error de base de datos' });
  }
}
