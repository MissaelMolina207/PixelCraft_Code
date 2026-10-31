// POST /api/checkout {items:[id,...]} -> {url} de Stripe Checkout. Precios SIEMPRE del servidor.
import { loadCatalog, readData } from '../lib/catalog.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(501).json({ error: 'Stripe no configurado' });

  const catalog = Object.fromEntries((await loadCatalog()).products.map(p => [p.id, p])); // precios editables en /admin
  const { currency } = readData('site.json');
  const counts = {};
  for (const id of Array.isArray(req.body?.items) ? req.body.items : []) if (catalog[id]) counts[id] = (counts[id] || 0) + 1;
  const ids = Object.keys(counts);
  if (!ids.length) return res.status(400).json({ error: 'Carrito vacío' });

  const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
  const form = new URLSearchParams({ mode: 'payment', success_url: `${origin}/?pago=ok`, cancel_url: `${origin}/#catalogo` });
  form.set('shipping_address_collection[allowed_countries][0]', 'MX');
  form.set('phone_number_collection[enabled]', 'true');
  ids.forEach((id, i) => {
    form.set(`line_items[${i}][quantity]`, counts[id]);
    form.set(`line_items[${i}][price_data][currency]`, currency);
    form.set(`line_items[${i}][price_data][unit_amount]`, Math.round(catalog[id].price * 100));
    form.set(`line_items[${i}][price_data][product_data][name]`, catalog[id].name);
  });
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form
  });
  const s = await r.json();
  if (!r.ok) return res.status(502).json({ error: 'Stripe rechazó la sesión' });
  res.status(200).json({ url: s.url });
}
