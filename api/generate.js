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

  const token = process.env.REPLICATE_API_TOKEN;
  
  // Depuración en consola de Vercel (muestra longitud y si existe)
  console.log("Verificando token de Replicate:", {
    exists: !!token,
    length: token ? token.length : 0,
    prefix: token ? token.substring(0, 4) : "ninguno"
  });

  if (!token) {
    return res.status(500).json({ error: 'REPLICATE_API_TOKEN no está configurado o está vacío en Vercel' });
  }

  try {
    const fullPrompt = `Commercial product photography, professional studio lighting, a clean white crewneck t-shirt centered on a neutral grey background, crisp detailed graphic print on the chest showing: ${prompt}. Photorealistic, 8k resolution.`;

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json",
        "Prefer": "wait"
      },
      body: JSON.stringify({
        version: "f121d5f38f36301423122c4f0f29a3e20e8a719c8f3522f7c00650993952f4d1",
        input: {
          prompt: fullPrompt,
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          output_quality: 90
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Replicate API Error Details:", data);
      const errorMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data);
      return res.status(500).json({ error: `Replicate Error: ${errorMsg}` });
    }

    let imageUrl = null;
    if (data.output && Array.isArray(data.output)) {
      imageUrl = data.output[0];
    } else if (data.urls && data.urls.get) {
      let statusUrl = data.urls.get;
      let statusData = data;
      
      while (statusData.status !== "succeeded" && statusData.status !== "failed") {
        await new Promise(r => setTimeout(r, 1000));
        const check = await fetch(statusUrl, {
          headers: { "Authorization": `Token ${token}` }
        });
        statusData = await check.json();
      }

      if (statusData.status === "failed") {
        return res.status(500).json({ error: "La ejecución falló en los servidores de Replicate" });
      }

      imageUrl = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output;
    }

    if (!imageUrl) {
      return res.status(500).json({ error: "No se pudo extraer la URL de la imagen generada" });
    }

    return res.status(200).json({ imageUrl });

  } catch (err) {
    console.error("Error crítico en servidor:", err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}