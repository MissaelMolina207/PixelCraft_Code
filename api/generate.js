// POST /api/generate {prompt} -> {image: dataURL}. Sin token responde 501 y el front usa el modo simulado.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return res.status(501).json({ error: 'Replicate no configurado' });
  const prompt = String(req.body?.prompt || '').trim().slice(0, 400);
  if (prompt.length < 4) return res.status(400).json({ error: 'Prompt muy corto' });

  const r = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({ input: { prompt: `${prompt}, centered graphic design, isolated on solid black background, print-ready`, aspect_ratio: '1:1', output_format: 'png', num_outputs: 1 } })
  });
  const p = await r.json();
  const url = p.output?.[0];
  if (!r.ok || !url) return res.status(502).json({ error: 'La generación falló' });

  // Se devuelve en base64 para que el canvas no quede "tainted" por CORS
  const img = Buffer.from(await (await fetch(url)).arrayBuffer());
  res.status(200).json({ image: `data:image/png;base64,${img.toString('base64')}` });
}
