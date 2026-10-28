// js/studio.js — Estudio IA: dos modos.
//   text   → describes la idea y la IA dibuja la playera con la estampa.
//   fusion → subes tu arte y la IA lo estampa en el pecho de una playera (como el ejemplo de Gemini).
import { $, toast, wa, post } from './utils.js';
import { store } from './store.js';
import { addItem, openCart } from './cart.js';

const SIZE = 480;
const MAX_CHARS = 340_000; // data URL máx. Debe ser ≤ MAX_IMAGE_CHARS de api/generate.js
const S = { mode: 'text', art: null, prompt: '', ref: null, busy: false };
let cv, cx;

// ---------- Canvas ----------
/** Dibuja la imagen cubriendo el canvas sin deformarla (el original la estiraba). */
function drawCover(img) {
  const k = Math.max(SIZE / img.width, SIZE / img.height);
  const w = img.width * k, h = img.height * k;
  cx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
}

function paintMsg(text) {
  cx.fillStyle = '#15161a';
  cx.fillRect(0, 0, SIZE, SIZE);
  cx.fillStyle = 'rgba(247,248,251,.6)';
  cx.font = '600 15px system-ui';
  cx.textAlign = 'center';
  cx.fillText(text, SIZE / 2, SIZE / 2);
}

function mock() {
  if (S.art) { cx.fillStyle = '#15161a'; cx.fillRect(0, 0, SIZE, SIZE); drawCover(S.art); }
  else paintMsg('Tu mockup fotorrealista aparecerá aquí');

  ['#buy', '#wa'].forEach(s => $(s).classList.toggle('off', !S.art));
  const msg = 'Hola PixelCraft, quiero cotizar un diseño generado por IA.\n'
    + (S.prompt ? `Prompt: "${S.prompt}"\n` : '') + 'Mockup: (adjunto en este chat)';
  $('#wa').href = S.art ? wa(store.site.whatsapp, msg) : '#';
}

const toImage = src => new Promise((ok, no) => {
  const i = new Image();
  i.crossOrigin = 'anonymous'; // solo aplica si el servidor devolvió imageUrl; con data URL no estorba
  i.onload = () => ok(i);
  i.onerror = () => no(new Error('No se pudo cargar la imagen generada.'));
  i.src = src;
});

// ---------- Subida de arte (fusión) ----------
/** Reduce el arte hasta que quepa en MAX_CHARS. Vercel limita el body a 4.5 MB y Replicate prefiere data URLs ≤ 256 KB. */
async function prepare(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Sube un PNG, JPG o WebP.');
  const bmp = await createImageBitmap(file);
  const attempts = [[768, 'image/png'], [768, 'image/jpeg', .9], [640, 'image/jpeg', .8], [512, 'image/jpeg', .7], [384, 'image/jpeg', .6]];
  for (const [max, type, q] of attempts) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    const g = c.getContext('2d');
    if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); } // JPEG no tiene alfa
    g.drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL(type, q);
    if (url.length <= MAX_CHARS) return url;
  }
  throw new Error('La imagen es demasiado pesada. Usa una más simple.');
}

async function loadFile(file) {
  if (!file) return;
  try {
    S.ref = await prepare(file);
    $('#refs').innerHTML = `<img src="${S.ref}" alt="Arte cargado">`;
    $('#dropTxt').textContent = 'Arte listo. Toca para cambiarlo.';
    $('#drop').classList.add('on');
  } catch (e) { toast(e.message); }
}

// ---------- Modos ----------
function setMode(m) {
  S.mode = m;
  $('#tabText').classList.toggle('red', m === 'text');
  $('#tabFusion').classList.toggle('red', m === 'fusion');
  $('#drop').style.display = m === 'fusion' ? 'block' : 'none';
  $('#refs').style.display = m === 'fusion' ? 'flex' : 'none';
  $('#prompt').placeholder = m === 'fusion'
    ? 'Opcional: color de playera, estilo, ajustes… (por defecto: playera blanca, tu arte al centro del pecho)'
    : 'Ej: calavera mecánica con engranes y tipografía industrial, rojo y blanco';
}

// ---------- Generación ----------
const WAIT = ['Cortando la tela…', 'Calibrando la tinta…', 'Planchando arrugas digitales…', 'La IA sigue pensando. Respeta su proceso…'];

async function generate(prompt) {
  const body = S.mode === 'fusion' ? { mode: 'fusion', prompt, image: S.ref } : { mode: 'text', prompt };
  const res = await post('/api/generate', body);
  return toImage(res.image || res.imageUrl);
}

export function initStudio() {
  cv = $('#cv');
  cx = cv.getContext('2d');

  $('#tabText').onclick = () => setMode('text');
  $('#tabFusion').onclick = () => setMode('fusion');
  $('#file').onchange = e => loadFile(e.target.files[0]);
  const drop = $('#drop');
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('on'); }));
  drop.addEventListener('drop', e => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); });

  const genBtn = $('#gen');
  genBtn.onclick = async () => {
    if (S.busy) return;
    const p = $('#prompt').value.trim();
    if (S.mode === 'text' && p.length < 3) return toast('Escribe una idea válida para generar el diseño.');
    if (S.mode === 'fusion' && !S.ref) return toast('Primero sube tu arte.');

    S.busy = true;
    genBtn.disabled = true;
    let n = 0;
    const tick = () => { const m = WAIT[Math.min(n++, WAIT.length - 1)]; genBtn.textContent = m; paintMsg(m); };
    tick();
    const timer = setInterval(tick, 5000);

    try {
      S.art = await generate(p);
      S.prompt = p;
      mock();
      toast('¡Mockup generado!');
    } catch (e) {
      console.error('Estudio IA:', e);
      mock();
      // El servidor ya manda mensajes en español y sin datos técnicos. Sin status = sin red/servidor.
      toast(e.status ? e.message : 'No hay conexión con el servidor. Revisa tu internet.');
    } finally {
      clearInterval(timer);
      S.busy = false;
      genBtn.disabled = false;
      genBtn.textContent = 'Generar diseño';
    }
  };

  $('#buy').onclick = () => {
    if (!S.art) return;
    // Nombre y precio salen de products.json: el mismo que usa /api/checkout. Antes el carrito mostraba $350 y Stripe cobraba $249.
    const prod = store.products.find(x => x.id === 'ia-shirt');
    if (!prod) return toast('Producto no disponible. Cotiza por WhatsApp.');
    let img = '';
    try { img = cv.toDataURL('image/jpeg', .7); } catch { /* canvas contaminado: carrito sin miniatura */ }
    addItem({ id: prod.id, name: prod.name, price: prod.price, img });
    openCart();
  };

  setMode('text');
  mock();
}