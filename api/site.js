// GET /api/site — Contenido público del sitio + CUPOS REALES de producción.
//   content  = lo que editaste en /admin → Sitio (D1) mezclado con data/content.json (valores por defecto)
//   capacity = { total, used, available, pct }
//     used = órdenes ACTIVAS EN EL TALLER: etapas "Por asignar", "En taller" y "Control de calidad" (de cualquier canal).
//            Las cotizaciones no ocupan cupo; lo enviado y lo entregado ya liberó el taller.
// Caché de borde de 30 s: el sitio casi no toca la base y aun así la barra se mueve "en vivo".
import { dbReady, first, DbError } from '../lib/db.js';
import { readData } from '../lib/catalog.js';
import { mergeContent, capacityOf } from '../lib/content.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const defaults = readData('content.json');
  let saved = null, used = null, source = 'json';

  if (dbReady()) {
    try {
      const [row, act] = await Promise.all([
        first(`SELECT v FROM settings WHERE k = 'site'`),
        first(`SELECT COUNT(*) AS n FROM orders WHERE stage IN ('approved', 'production', 'quality')`)
      ]);
      if (row?.v) { try { saved = JSON.parse(row.v); } catch { /* contenido corrupto: se usan los defaults */ } }
      used = act?.n ?? 0;
      source = 'd1';
    } catch (err) {
      console.error('[site] D1 no respondió, uso archivos estáticos:', err instanceof DbError ? err.detail : err.message);
    }
  }
  const content = mergeContent(defaults, saved);
  if (used == null) used = readData('site.json').slots?.used ?? 0; // sin base: el número estático de data/site.json
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
  res.setHeader('X-Site-Source', source);
  return res.status(200).json({ content, capacity: { ...capacityOf(content.capacity.total, used), source } });
}
