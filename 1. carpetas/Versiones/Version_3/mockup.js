// ============================================================
// mockup.js - Compone producto + diseño del cliente en <canvas>.
// Sin servidor ni API de IA: instantáneo y gratis.
// Producto nuevo = una entrada más en PRODUCTS.
// ============================================================

/** Foto base, zona de impresión (fracciones 0-1: x, y, ancho, alto) y modo de mezcla.
 *  blend 'multiply' = tinta sobre prenda clara; usa 'source-over' en prendas oscuras. */
const PRODUCTS = {
  sudadera: { src: 'assets/sudadera.webp', area: { x: 0.39, y: 0.28, w: 0.236, h: 0.35 }, blend: 'multiply' },
  // taza: { src: 'assets/taza.webp', area: { x: 0.30, y: 0.30, w: 0.30, h: 0.40 }, blend: 'multiply' },
};
const ACTIVE = 'sudadera';           // producto que muestra el hero
const MAX_PX = 1200;                 // tope de procesado: protege al móvil de imágenes enormes
const INK = { lo: 150, hi: 215 };    // luminosidad: <=lo es tinta, >=hi es fondo (transparente)

const $ = (id) => document.getElementById(id);
const canvas = $('mockup');
const ctx = canvas.getContext('2d');
const status = $('status');
const dl = $('dl');
let lastBlob = null;                 // último mockup en JPEG; form.js lo adjunta al lead

/** Mockup actual como Blob (null si aún no hay diseño). */
export const getMockupBlob = () => lastBlob;

const loadImg = (src) => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = fail;
  img.src = src;
});

/** Quita el fondo claro (rampa suave, sin bordes duros) y mide dónde está la tinta.
 *  Si el PNG ya trae transparencia, no toca nada: respeta tu arte. */
function cutBackground(img) {
  const k = Math.min(1, MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, c.width, c.height);

  const frame = g.getImageData(0, 0, c.width, c.height);
  const px = frame.data;
  let hasAlpha = false;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { hasAlpha = true; break; }

  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (!hasAlpha) {
      const lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      const ink = 1 - Math.min(1, Math.max(0, (lum - INK.lo) / (INK.hi - INK.lo)));
      px[i + 3] = Math.round(ink * 255);
    }
    if (px[i + 3] > 128) {           // caja que envuelve la tinta, para recortar márgenes
      const p = i / 4, x = p % c.width, y = Math.floor(p / c.width);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  g.putImageData(frame, 0, 0);
  const box = x1 >= x0
    ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
    : { x: 0, y: 0, w: c.width, h: c.height };   // todo era fondo: usa la imagen entera
  return { c, box };
}

/** Dibuja la foto del producto y, si hay diseño, lo estampa en la zona de impresión. */
async function render(design) {
  const p = PRODUCTS[ACTIVE];
  const base = await loadImg(p.src);
  const k = Math.min(1, 1000 / base.naturalWidth);       // máx. 1000 px: nítido y ligero
  canvas.width = Math.round(base.naturalWidth * k);      // (cambiar el tamaño reinicia el contexto)
  canvas.height = Math.round(base.naturalHeight * k);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
  if (!design) return;

  const { c, box } = cutBackground(design);
  const ax = p.area.x * canvas.width,  ay = p.area.y * canvas.height;
  const aw = p.area.w * canvas.width,  ah = p.area.h * canvas.height;
  const s = Math.min(aw / box.w, ah / box.h);            // "contain": cabe entero, sin deformar
  const w = box.w * s, h = box.h * s;

  ctx.globalCompositeOperation = p.blend;                // la tinta se funde con la tela
  ctx.drawImage(c, box.x, box.y, box.w, box.h, ax + (aw - w) / 2, ay + (ah - h) / 2, w, h);
  ctx.globalCompositeOperation = 'source-over';

  // Guarda el resultado para descargarlo y para adjuntarlo al formulario
  await new Promise((done) => canvas.toBlob((b) => { lastBlob = b; done(); }, 'image/jpeg', 0.85));
}

/** Flujo completo desde una URL (archivo del cliente o demo). */
async function useDesign(src) {
  status.textContent = 'Imprimiendo (con píxeles, no con tinta)...';
  try {
    const img = await loadImg(src);
    if (src.startsWith('blob:')) URL.revokeObjectURL(src);   // libera memoria
    await render(img);
    URL.revokeObjectURL(dl.href);
    dl.href = URL.createObjectURL(lastBlob);
    dl.hidden = false;
    status.textContent = 'Listo. Así se ve. Ahora imagínalo en cincuenta.';
  } catch {
    status.textContent = 'Esa imagen no abrió. Prueba con JPG, PNG o WebP.';
  }
}

// ---------- Eventos ----------
$('pick').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';                                    // permite volver a elegir el mismo archivo
  if (!f) return;
  if (f.size > 15e6) { status.textContent = 'Pesa demasiado (máx. 15 MB). Comprímela e inténtalo de nuevo.'; return; }
  useDesign(URL.createObjectURL(f));
});
$('demo').addEventListener('click', () => useDesign('assets/luna.webp'));

render(null).catch(() => { status.textContent = 'No cargó la foto del producto.'; });   // estado inicial
