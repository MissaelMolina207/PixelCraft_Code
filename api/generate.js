export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'Se requiere una descripción o prompt' });
    }

    // Estructuramos el prompt optimizado para el mockup de la playera
    const fullPrompt = `Commercial product photography, professional studio lighting, a clean white crewneck t-shirt centered on a neutral grey background, crisp detailed graphic print on the chest showing: ${prompt}. Photorealistic, 8k resolution.`;

    // Generamos la URL directa con el motor gratuito Pollinations.ai
    const encodedPrompt = encodeURIComponent(fullPrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;

    return res.status(200).json({ imageUrl });

  } catch (err) {
    console.error("Error crítico en servidor:", err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}