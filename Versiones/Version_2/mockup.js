/* mockup.js — estudio interactivo: producto en blanco + arte (subido o generado con IA) */
import { CONFIG } from './config.js';

/** Estado compartido: leads.js lo lee al enviar el formulario. */
export const estado = { producto: 'playera', arteUrl: '', archivo: null };

const $ = (id) => document.getElementById(id);
const avisar = () => document.dispatchEvent(new CustomEvent('estudio:cambio'));

/** Pinta el arte sobre el producto. `archivo` solo existe si el usuario subió su logo. */
function setArte(url, archivo = null) {
  Object.assign(estado, { arteUrl: archivo ? '' : url, archivo });
  const img = $('arte');
  img.src = url;
  img.hidden = false;
  img.classList.remove('stamp');
  void img.offsetWidth;               // fuerza reflow para reiniciar la animación
  img.classList.add('stamp');
  avisar();
}

/** Promesa real con timeout. (El original lanzaba el error dentro de onerror: nadie lo atrapaba y el botón quedaba muerto.) */
const cargarImagen = (url) => new Promise((ok, fail) => {
  const img = new Image();
  const t = setTimeout(() => fail(new Error('timeout')), CONFIG.IA_TIMEOUT_MS);
  img.onload = () => { clearTimeout(t); ok(url); };
  img.onerror = () => { clearTimeout(t); fail(new Error('carga')); };
  img.src = url;
});

export function initEstudio() {
  const mockup = $('mockup'), aviso = $('estadoIA'), btn = $('btnIA');

  // Selector de producto
  document.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === chip));
    estado.producto = mockup.dataset.producto = chip.dataset.producto;
    avisar();
  }));

  // Logo propio: se queda en el navegador hasta que envías el formulario
  $('archivo').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > CONFIG.MAX_ARCHIVO_MB * 1048576) {
      aviso.textContent = `Máximo ${CONFIG.MAX_ARCHIVO_MB} MB. Tu logo no necesita ser una foto RAW.`;
      return;
    }
    setArte(URL.createObjectURL(f), f);
    aviso.textContent = '';
  });

  // Arte con IA
  $('formIA').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = $('promptIA').value.trim();
    if (!prompt) { aviso.textContent = 'Escribe algo. La IA lee mentes, pero solo las de pago.'; return; }
    btn.disabled = true; btn.textContent = 'Renderizando…';
    mockup.classList.add('is-loading'); aviso.textContent = '';
    try {
      setArte(await cargarImagen(CONFIG.IA_URL(prompt, Math.floor(Math.random() * 1e6))));
    } catch {
      aviso.textContent = 'La IA se tomó el día. Reintenta o sube tu logo.';
    } finally {                        // siempre se reactiva el botón, pase lo que pase
      btn.disabled = false; btn.textContent = 'Generar con IA'; mockup.classList.remove('is-loading');
    }
  });
}
