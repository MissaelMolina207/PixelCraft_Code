/* config.js — ÚNICO archivo que tocas al cambiar de entorno o proveedor. */
const local = ['localhost', '127.0.0.1'].includes(location.hostname);

export const CONFIG = {
  // Local: URL de TEST de n8n (solo responde mientras el editor escucha).
  // Producción: URL /webhook/ (workflow ACTIVO) y HTTPS público. localhost no existe para tus visitantes.
  WEBHOOK_URL: local
    ? 'http://localhost:5678/webhook-test/solicitud-muestra-serigraph'
    : 'https://TU-N8N.ejemplo.com/webhook/solicitud-muestra-serigraph',

  WHATSAPP: '5214621954045',   // formato wa.me: país + número, sin + ni espacios
  MAX_ARCHIVO_MB: 5,

  // Proveedor de IA aislado aquí: si Pollinations cambia reglas, cambias UNA línea.
  // Escalado serio: apunta esto a un webhook de n8n que llame al proveedor con tu API key (nunca en el front).
  IA_URL: (prompt, seed) =>
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${seed}`,
  IA_TIMEOUT_MS: 25000,
};
