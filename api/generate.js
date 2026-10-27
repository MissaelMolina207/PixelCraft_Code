export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Se requiere una descripción o prompt' });
  }

  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'REPLICATE_API_TOKEN no está configurado en Vercel' });
  }

  try {
    const systemPrompt = `Professional commercial product mockup photo of a clean white short-sleeve crewneck t-shirt centered on a smooth neutral light grey studio background. On the center of the chest, there is a crisp, high-detail graphic print showing: ${prompt}. Soft studio lighting, realistic cotton fabric texture and natural folds, photorealistic, 8k resolution.`;

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: "f121d5f38f36301423122c4f0f29a3e20e8a719c8f3522f7c00650993952f4d1", // Flux Schnell
        input: {
          prompt: systemPrompt,
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 90
        }
      })
    });

    const prediction = await response.json();

    if (prediction.error) {
      return res.status(500).json({ error: prediction.error });
    }

    let result = prediction;
    while (result.status !== "succeeded" && result.status !== "failed") {
      await new Promise(r => setTimeout(r, 1000));
      const checkRes = await fetch(result.urls.get, {
        headers: { "Authorization": `Token ${token}` }
      });
      result = await checkRes.json();
    }

    if (result.status === "failed") {
      return res.status(500).json({ error: "Fallo la generación de la imagen en Replicate" });
    }

    return res.status(200).json({ imageUrl: result.output[0] });

  } catch (error) {
    console.error("Error en generate API:", error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}