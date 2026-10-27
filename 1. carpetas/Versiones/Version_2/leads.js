/* leads.js — enlaces de WhatsApp, botones de pedido y envío del formulario a n8n */
import { CONFIG } from './config.js';
import { estado } from './mockup.js';

const $ = (id) => document.getElementById(id);
const NOMBRES = { playera: 'Playera', taza: 'Taza', pluma: 'Pluma', llavero: 'Llavero' };
// https://wa.me funciona en móvil y escritorio. whatsapp:// (tu versión) revienta sin la app instalada.
const waUrl = (txt) => `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(txt)}`;

/** POST a n8n. FormData = petición "simple" (sin preflight CORS) y admite archivos. */
const enviar = (fd, opts = {}) => fetch(CONFIG.WEBHOOK_URL, { method: 'POST', body: fd, ...opts });

export function initLeads() {
  const form = $('formMuestra');

  // 1) Todos los [data-wa] salen de CONFIG: un solo número que mantener.
  document.querySelectorAll('[data-wa]').forEach((a) => {
    const texto = a.dataset.wa || 'Hola Pixelcraft, quiero info de serigrafía e impresión 3D.';
    Object.assign(a, { href: waUrl(texto), target: '_blank', rel: 'noopener' });
    if (!a.dataset.wa) return;
    a.addEventListener('click', () => {          // tracking silencioso del clic (keepalive sobrevive a la navegación)
      const fd = new FormData();
      fd.set('tipo', 'clic_whatsapp'); fd.set('detalle', a.dataset.wa); fd.set('fecha', new Date().toISOString());
      enviar(fd, { keepalive: true }).catch(() => {});
    });
  });

  // 2) Resumen sobre el formulario: producto + si ya hay arte
  const resumen = () => {
    const arte = estado.archivo ? 'tu logo' : estado.arteUrl ? 'arte con IA' : 'sin arte aún';
    $('resumen').textContent = `📦 ${form.producto.value} · ${arte}`;
  };
  document.addEventListener('estudio:cambio', () => { form.producto.value = NOMBRES[estado.producto]; resumen(); });
  document.querySelectorAll('[data-pedir]').forEach((b) => b.addEventListener('click', () => {
    form.producto.value = b.dataset.pedir; resumen();
    $('muestra').scrollIntoView({ behavior: 'smooth' });
  }));
  resumen();

  // 3) Envío del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const aviso = $('estadoForm'), btn = form.querySelector('[type=submit]');
    const fd = new FormData(form);                                      // todo lo que tenga name=
    fd.set('whatsapp', String(fd.get('whatsapp')).replace(/\D/g, ''));  // solo dígitos
    fd.set('urlArte', estado.arteUrl);
    if (estado.archivo) fd.set('archivoDiseno', estado.archivo);        // binario → n8n lo recibe en $binary
    fd.set('fecha', new Date().toISOString());

    btn.disabled = true; aviso.className = ''; aviso.textContent = 'Enviando…';
    try {
      const r = await enviar(fd);                                       // sin keepalive: el archivo pesa más de 64 KB
      if (!r.ok) throw new Error(r.status);
      const { folio = '' } = await r.json().catch(() => ({}));
      form.reset(); resumen();
      aviso.className = 'ok';
      aviso.textContent = `Listo. Folio ${folio}. Te escribimos por WhatsApp. Sin spam, solo playeras.`;
    } catch {
      aviso.className = 'err';
      aviso.textContent = 'No se envió. Revisa tus datos o escríbenos por WhatsApp.';
    } finally { btn.disabled = false; }
  });
}
