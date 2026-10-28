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
    // Prompt estricto enfocado únicamente en la prenda, evitando rostros u otras personas
    const fullPrompt = `Flat lay product photography of a clean white crewneck t-shirt centered on a neutral solid grey background, sharp focus on the chest area showing a crisp detailed custom graphic design of: ${prompt}. Professional studio lighting, commercial e-commerce look, no models, no people, 8k resolution.`;

    // Petición directa a Hugging Face usando FLUX.1-schnell
    const response = await fetch("https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-use-cache": "false"
      },
      body: JSON.stringify({ 
        inputs: fullPrompt,
        options: { wait_for_model: true }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Hugging Face API Error:", errText);
      return res.status(500).json({ error: `Error en Hugging Face: ${errText}` });
    }

    // Convertimos la respuesta binaria de la imagen a Base64 para mostrarla limpiamente
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    return res.status(200).json({ imageUrl });

  } catch (err) {
    console.error("Error crítico en servidor:", err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}