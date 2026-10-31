// GET /api/track?folio=PC-1001&tel=1234 — Rastreo PÚBLICO. Folio + últimos 4 dígitos del teléfono (segundo factor:
// los folios son consecutivos y se adivinan). Responde solo la vista pública: sin costos, márgenes ni notas internas.
import { dbReady, first, all, DbError } from '../lib/db.js';
import { publicView } from '../lib/orders.js';
import { limited, clientIp } from '../lib/limits.js';

const NOT_FOUND = 'No encontramos ese pedido. Revisa tu folio y los últimos 4 dígitos de tu teléfono.';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  if (limited(`track:${clientIp(req)}`, 12)) return res.status(429).json({ error: 'Muchas consultas. Espera un minuto.' });
  if (!dbReady()) return res.status(503).json({ error: 'El rastreo no está disponible por ahora. Escríbenos por WhatsApp.' });

  const q = new URL(req.url || '/', 'http://x').searchParams;
  const folio = (q.get('folio') || '').trim().toUpperCase();
  const tel = (q.get('tel') || '').replace(/\D/g, '').slice(-4);
  if (!/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(folio) || tel.length !== 4) return res.status(404).json({ error: NOT_FOUND });

  try {
    const o = await first('SELECT * FROM orders WHERE folio = ?', [folio]);
    // Mismo mensaje y misma ruta de código si no existe o si el teléfono no coincide: no se puede enumerar folios.
    if (!o || o.phone.slice(-4) !== tel) return res.status(404).json({ error: NOT_FOUND });
    const events = await all('SELECT stage, at FROM order_events WHERE folio = ? ORDER BY id', [folio]);
    return res.status(200).json(publicView(o, events));
  } catch (err) {
    console.error('[track]', err.status ?? '', err.detail ?? err.message);
    return res.status(502).json({ error: 'No pudimos consultar tu pedido. Intenta de nuevo en un momento.' });
  }
}
