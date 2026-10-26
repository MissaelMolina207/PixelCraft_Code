// POST /api/lead -> valida y reenvía a n8n (que crea tarjeta en Trello, fila en Notion, aviso al taller).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const url = process.env.N8N_LEAD_WEBHOOK;
  if (!url) return res.status(501).json({ error: 'Webhook no configurado' });
  const { nombre, contacto, tipo, proyecto, web, origen, cart } = req.body ?? {};
  if (web) return res.status(200).json({ ok: true }); // honeypot: el bot cree que ganó
  if (!nombre || !contacto || !proyecto) return res.status(400).json({ error: 'Faltan campos' });

  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: String(nombre).slice(0, 120), contacto: String(contacto).slice(0, 160), tipo, proyecto: String(proyecto).slice(0, 2000), origen, cart, fecha: new Date().toISOString() })
  });
  if (!r.ok) return res.status(502).json({ error: 'n8n no respondió' });
  res.status(200).json({ ok: true });
}
