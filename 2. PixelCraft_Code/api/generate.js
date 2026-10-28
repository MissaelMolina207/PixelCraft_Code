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

  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'Se requiere una descripción o prompt' });
  }

  const token = process.env.HUGGINGFACE_API_KEY;
  if (!token) {
    return res.status(500).json({ error: 'HUGGINGFACE_API_KEY no está configurado en Vercel' });
  }

  try {
    const fullPrompt = `Commercial product photography, professional studio lighting, a clean white crewneck t-shirt centered on a neutral grey background, crisp detailed graphic print on the chest showing: ${prompt}. Photorealistic, 8k resolution, highly detailed fabric texture.`;

    // Petición al modelo gratuito de Flux Schnell en Hugging Face
    const response = await fetch("https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: fullPrompt })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Hugging Face API Error:", errText);
      return res.status(500).json({ error: `Error en Hugging Face: ${errText}` });
    }

    // Hugging Face devuelve la imagen binaria directamente, la convertimos a Base64 Data URI
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    return res.status(200).json({ imageUrl });

  } catch (err) {
    console.error("Error crítico en servidor:", err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}