// GET /api/products — Catálogo público. D1 (editable desde /admin) con respaldo en data/products.json.
// Caché de borde: 60 s fresco + 5 min stale-while-revalidate → el sitio casi no toca la base.
import { loadCatalog } from '../lib/catalog.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { products, source } = await loadCatalog();
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.setHeader('X-Catalog-Source', source);
  return res.status(200).json(products);
}
