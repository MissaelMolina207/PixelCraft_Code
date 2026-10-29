// js/studio.js — Estudio IA: dos modos.
//   text   → describes la idea y la IA dibuja la playera con la estampa.
//   fusion → subes tu arte y la IA lo estampa en el pecho de una playera (como el ejemplo de Gemini).
// js/studio.js — Estudio IA adaptado para renderizado directo de imágenes
import { $, toast, wa, post } from './utils.js';
import { store } from './store.js';
import { addItem, openCart } from './cart.js';

const MAX_CHARS = 340_000; 
const S = { mode: 'text', artUrl: null, prompt: '', ref: null, busy: false };
let cv, cx;

function updateUIState() {
  const hasArt = !!S.artUrl;
  const imgEl = $('#aiGeneratedImage');
  const placeholder = $('#aiPlaceholderText');

  if (hasArt) {
    if (imgEl) {
      imgEl.src = S.artUrl;
      imgEl.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
  } else {
    if (imgEl) imgEl.style.display = 'none';
    if (placeholder) {
      placeholder.style.display = 'block';
      placeholder.textContent = 'Tu render fotorrealista aparecerá aquí';
    }
  }

  ['#buy', '#wa'].forEach(s => $(s).classList.toggle('off', !hasArt));
  const msg = 'Hola PixelCraft, quiero cotizar un diseño generado por IA.\n'
    + (S.prompt ? `Prompt: "${S.prompt}"\n` : '') + 'Mockup: (adjunto en este chat)';
  $('#wa').href = hasArt ? wa(store.site.whatsapp, msg) : '#';
}

function paintLoadingMsg(text) {
  const placeholder = $('#aiPlaceholderText');
  const imgEl = $('#aiGeneratedImage');
  if (imgEl) imgEl.style.display = 'none';
  if (placeholder) {
    placeholder.style.display = 'block';
    placeholder.textContent = text;
  }
}

const toImage = src => new Promise((ok, no) => {
  const i = new Image();
  i.crossOrigin = 'anonymous';
  i.onload = () => {
    // Dibujamos de forma oculta en el canvas interno solo para el respaldo del carrito
    if (cv && cx) {
      const k = Math.max(480 / i.width, 480 / i.height);
      const w = i.width * k, h = i.height * k;
      cx.fillStyle = '#15161a';
      cx.fillRect(0, 0, 480, 480);
      cx.drawImage(i, (480 - w) / 2, (480 - h) / 2, w, h);
    }
    ok(src);
  };
  i.onerror = () => no(new Error('No se pudo cargar la imagen generada.'));
  i.src = src;
});

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
    if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
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

function setMode(m) {
  S.mode = m;
  $('#tabText').classList.toggle('red', m === 'text');
  $('#tabFusion').classList.toggle('red', m === 'fusion');
  $('#drop').style.display = m === 'fusion' ? 'block' : 'none';
  $('#refs').style.display = m === 'fusion' ? 'flex' : 'none';
  $('#prompt').placeholder = m === 'fusion'
    ? 'Opcional: estilo, ajustes adicionales…'
    : 'Ej: un soporte para celular con forma de nave espacial, o un llavero 3D con letras metálicas...';
}

const WAIT = ['Generando modelo 3D…', 'Renderizando iluminación…', 'Ajustando texturas y detalles…', 'Casi listo…'];

async function generate(prompt) {
  const body = S.mode === 'fusion' ? { mode: 'fusion', prompt, image: S.ref } : { mode: 'text', prompt };
  const res = await post('/api/generate', body);
  return res.image || res.imageUrl;
}

export function initStudio() {
  cv = $('#cv');
  if (cv) cx = cv.getContext('2d');

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
    const tick = () => { const m = WAIT[Math.min(n++, WAIT.length - 1)]; genBtn.textContent = m; paintLoadingMsg(m); };
    tick();
    const timer = setInterval(tick, 5000);

    try {
      const rawUrl = await generate(p);
      S.artUrl = await toImage(rawUrl);
      S.prompt = p;
      updateUIState();
      toast('¡Mockup generado!');
    } catch (e) {
      console.error('Estudio IA:', e);
      updateUIState();
      toast(e.status ? e.message : 'No hay conexión con el servidor. Revisa tu internet.');
    } finally {
      clearInterval(timer);
      S.busy = false;
      genBtn.disabled = false;
      genBtn.textContent = 'Generar diseño';
    }
  };

  $('#buy').onclick = () => {
    if (!S.artUrl) return;
    const prod = store.products.find(x => x.id === 'ia-shirt');
    if (!prod) return toast('Producto no disponible. Cotiza por WhatsApp.');
    let img = '';
    try { img = cv.toDataURL('image/jpeg', .7); } catch { /* canvas contaminado */ }
    addItem({ id: prod.id, name: prod.name, price: prod.price, img });
    openCart();
  };

  fetch('/api/generate').then(r => r.json()).then(c => { if (!c.fusion) $('#tabFusion').style.display = 'none'; }).catch(() => {});

  setMode('text');
  updateUIState();
}
