// ============================================================
// form.js - Envía el lead (y el mockup) al webhook de n8n.
// El destino vive en <form data-webhook="...">: se cambia sin tocar JS.
// Importar mockup.js también lo arranca (un solo <script> en el HTML).
// ============================================================
import { getMockupBlob } from './mockup.js';

const form = document.getElementById('lead');
const msg = document.getElementById('msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  if (data.get('website')) return;                        // honeypot: los bots lo llenan, los humanos ni lo ven

  const mockup = getMockupBlob();
  if (mockup) data.append('mockup', mockup, 'mockup.jpg'); // el diseño del cliente viaja con el mensaje

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;                                    // evita doble envío
  msg.textContent = 'Enviando...';
  try {
    const res = await fetch(form.dataset.webhook, { method: 'POST', body: data });
    if (!res.ok) throw new Error(res.status);
    form.reset();
    msg.textContent = 'Recibido. Te escribimos pronto. Mientras tanto, no te arrepientas.';
  } catch {
    msg.textContent = 'Algo falló (probablemente no fuiste tú). Reintenta en un momento.';
  } finally {
    btn.disabled = false;
  }
});
