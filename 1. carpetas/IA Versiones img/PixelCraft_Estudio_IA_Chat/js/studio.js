// js/studio.js — Orquestador del Estudio IA (chat): estado, red y reglas de negocio.
// El DOM vive en studio-ui.js; el procesamiento de imágenes en studio-images.js; los prompts en el servidor (lib/prompts.js).
import { fmt, toast, wa, post } from './utils.js';
import { store } from './store.js';
import { addItem, openCart } from './cart.js';
import { prepareImage, thumbnail, MAX_IMAGES } from './studio-images.js';
import { createChatUI } from './studio-ui.js';

/** Producto del chat → muestra comprable en products.json (hidden:true). Sin entrada = solo cotización. */
const SAMPLE_ID = { playera: 'ia-shirt', letrero: 'ia-plate', acrilico: 'ia-plate' };

const START_CHIPS = ['Una playera con un hot dog retro', 'Llavero 3D con mi mascota', 'Stickers troquelados de mi marca', 'Taza para regalo de cumpleaños'];
const FOLLOW_CHIPS = ['Hazlo en otros colores', 'Más minimalista', 'Estilo retro', 'Ponlo en una sudadera'];
const WAIT = [[0, 'Entendiendo tu idea…'], [1800, 'Mejorando el prompt…'], [4500, 'Dibujando tu diseño…'], [14000, 'Esto toma unos segundos más…']];
const ERR = {
  404: 'El API no responde aquí. En local usa "vercel dev"; en producción revisa el deploy.',
  413: 'Las imágenes pesan demasiado. Prueba con una más ligera.',
  504: 'Tardó demasiado. Intenta de nuevo.'
};

const S = {
  refs: [],        // imágenes de referencia: persisten toda la conversación
  fresh: [],       // adjuntadas desde el último envío (solo para pintarlas en la burbuja)
  prev: null,      // último brief {product, color, artwork…}: viaja al servidor para iterar ("hazlo rojo")
  last: null,      // último diseño generado
  asks: [],        // lo que pidió el cliente (para la cotización)
  busy: false,
  caps: { ready: true, refs: true, hd: false }
};
let ui;

// El WhatsApp de site.json sigue en placeholder (5210000000000): cada lead se iría al vacío.
const waIsPlaceholder = n => !/^\d{10,15}$/.test(n || '') || /0{7,}$/.test(n);

function quoteMessage() {
  const { spec } = S.last;
  const asks = S.asks.slice(-3).map(a => `"${a}"`).join(' → ');
  return [
    'Hola PixelCraft, quiero cotizar esta pieza que diseñé en el Estudio IA:',
    `• Producto: ${spec.label}`,
    spec.summary ? `• Idea: ${spec.summary}` : null,
    asks ? `• Lo que pedí: ${asks}` : null,
    S.refs.length ? '• Usé mi propio arte (lo adjunto en este chat)' : null,
    'Te mando la imagen del diseño aquí mismo. ¿Me ayudas con precio, cantidades y tiempos?'
  ].filter(Boolean).join('\n');
}

function updateCta() {
  if (!S.last) return ui.setCta();
  const { total, used } = store.site.slots || {};
  const left = total ? total - used : 0; // dato real de site.json, no inventado
  ui.setCta({
    href: wa(store.site.whatsapp, quoteMessage()),
    note: (left > 0 ? `Quedan ${left} lugares de producción este mes. ` : '') + 'Descarga la imagen y adjúntala en el chat de WhatsApp.'
  });
}

async function buy(prod, image) {
  addItem({ id: prod.id, name: prod.name, price: prod.price, img: await thumbnail(image) });
  openCart();
}

/** Botones de una imagen generada: HD (si el servidor lo permite) y muestra comprable (si el producto la tiene). */
function actionsFor(spec, image, isHD) {
  const actions = [];
  if (S.caps.hd && !isHD) actions.push({ label: 'Render HD', onClick: () => renderHD(spec) });
  const prod = store.products.find(p => p.id === SAMPLE_ID[spec.product]);
  if (prod) actions.push({ label: `Comprar muestra · ${fmt(prod.price)}`, onClick: () => buy(prod, image) });
  return actions;
}

/** Envuelve una llamada al servidor con el estado "ocupado" y el indicador de escritura. */
async function withTyping(first, fn) {
  if (S.busy) return;
  S.busy = true;
  ui.setBusy(true);
  const typing = ui.typing(first[0][1]);
  const timers = first.slice(1).map(([ms, msg]) => setTimeout(() => typing.set(msg), ms));
  try {
    await fn();
  } catch (e) {
    console.error('Estudio IA:', e);
    ui.addBot({ error: true, text: e.status ? (ERR[e.status] ?? e.message) : 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.' });
  } finally {
    timers.forEach(clearTimeout);
    typing.stop();
    S.busy = false;
    ui.setBusy(false);
    ui.focus();
  }
}

function ask(text) {
  const shown = S.fresh;
  S.fresh = [];
  if (S.busy) return;
  ui.addUser(text, shown);
  return withTyping(WAIT, async () => {
    const res = await post('/api/generate', { prompt: text, images: S.refs, prev: S.prev });
    const image = res.image || res.imageUrl;
    S.prev = res.spec;
    if (text) S.asks.push(text);
    S.last = { image, spec: res.spec };
    ui.addBot({
      text: res.reply, image, tag: 'Borrador', promptEn: res.promptEn,
      actions: actionsFor(res.spec, image, false), chips: FOLLOW_CHIPS, onChip: ask
    });
    updateCta();
  });
}

function renderHD(spec) {
  return withTyping([[0, 'Renderizando en alta calidad…'], [12000, 'Afinando los detalles…']], async () => {
    const res = await post('/api/generate', { quality: 'hd', rerender: true, prev: spec, images: S.refs, prompt: '' });
    const image = res.image || res.imageUrl;
    S.last = { image, spec: res.spec };
    ui.addBot({ text: res.reply, image, tag: 'Render HD', hd: true, promptEn: res.promptEn, actions: actionsFor(res.spec, image, true) });
    updateCta();
  });
}

async function onFiles(files) {
  if (!S.caps.refs) return toast('Por ahora el Estudio no acepta imágenes. Describe tu idea con texto.');
  const imgs = files.filter(f => f.type.startsWith('image/'));
  if (!imgs.length) return;
  const room = MAX_IMAGES - S.refs.length;
  if (imgs.length > room) toast(`Máximo ${MAX_IMAGES} imágenes.`);
  for (const f of imgs.slice(0, Math.max(room, 0))) {
    try {
      const data = await prepareImage(f);
      S.refs.push(data);
      S.fresh.push(data);
    } catch (e) { toast(e.message); }
  }
  ui.setTray(S.refs);
  ui.focus();
}

function welcome() {
  ui.addBot({
    text: '¡Hola! Cuéntame qué quieres mandar a hacer: playeras, llaveros 3D, stickers, tazas, letreros… Escribe tu idea o adjunta tu arte y te muestro cómo se vería. Cuando te guste, lo cotizamos por WhatsApp.',
    chips: START_CHIPS, onChip: ask
  });
}

function reset() {
  if (S.busy) return;
  Object.assign(S, { refs: [], fresh: [], prev: null, last: null, asks: [] });
  ui.clear();
  ui.setTray([]);
  ui.setCta();
  welcome();
}

export function initStudio() {
  ui = createChatUI({
    onSend: text => ask(text),
    onFiles,
    onRemoveRef: i => {
      const [gone] = S.refs.splice(i, 1);
      S.fresh = S.fresh.filter(f => f !== gone);
      ui.setTray(S.refs);
    },
    onReset: reset
  });
  ui.onQuote(e => {
    if (waIsPlaceholder(store.site.whatsapp)) { e.preventDefault(); toast('Falta configurar el WhatsApp del taller en data/site.json.'); }
  });
  welcome();

  // Capacidades del servidor: decide qué botones existen. Si falla, se asume todo disponible y el error real sale al enviar.
  fetch('/api/generate').then(r => (r.ok ? r.json() : Promise.reject())).then(c => {
    Object.assign(S.caps, c);
    ui.setAttachEnabled(c.refs !== false);
    if (c.ready === false) {
      ui.disable('Estudio en mantenimiento. Cotiza por WhatsApp.');
      ui.addBot({ error: true, text: 'El Estudio IA está en mantenimiento. Cuéntanos tu idea por WhatsApp y la hacemos a mano.' });
    }
  }).catch(() => {});
}
