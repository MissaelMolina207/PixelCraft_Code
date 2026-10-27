export default async function handler(req, res) {
  // Configurar cabeceras CORS por seguridad
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: 'Se requiere una descripción o prompt' });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'REPLICATE_API_TOKEN no está configurado en Vercel' });
    }

    const systemPrompt = `Professional commercial product mockup photo of a clean white short-sleeve crewneck t-shirt centered on a smooth neutral light grey studio background. On the center of the chest, there is a crisp, high-detail graphic print showing: ${prompt}. Soft studio lighting, realistic cotton fabric texture and natural folds, photorealistic, 8k resolution.`;

    // 1. Crear la predicción en Replicate usando Flux Schnell
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Prefer": "wait"
      },
      body: JSON.stringify({
        version: "f121d5f38f36301423122c4f0f29a3e20e8a719c8f3522f7c00650993952f4d1",
        input: {
          prompt: systemPrompt,
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 90
        }
      })
    });

    const prediction = await createRes.json();

    if (!createRes.ok || prediction.error) {
      return res.status(500).json({ error: prediction.error || 'Error al comunicarse con la API de Replicate' });
    }

    let imageUrl = null;
    let result = prediction;

    // Si ya viene el output directo por el header "Prefer: wait"
    if (result.output && result.output.length > 0) {
      imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    } else if (result.urls && result.urls.get) {
      // 2. Polling si la predicción está en proceso
      while (result.status !== "succeeded" && result.status !== "failed") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const statusRes = await fetch(result.urls.get, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        result = await statusRes.json();
      }

      if (result.status === "failed") {
        return res.status(500).json({ error: "La generación de la imagen falló en el motor de IA" });
      }

      imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    }

    if (!imageUrl) {
      return res.status(500).json({ error: "No se pudo obtener la URL de la imagen generada" });
    }

    return res.status(200).json({ imageUrl });

  } catch (error) {
    console.error("Error crítico en generate API:", error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}