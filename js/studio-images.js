// js/studio-images.js — Adjuntos del cliente: validar, reducir y convertir a data URL.
// FLUX.2 klein exige referencias ≤ 512 px y Replicate recomienda data URLs ≤ 256 KB: reducimos en el navegador.
export const MAX_IMAGES = 2;
const MAX_SIDE = 480;
const MAX_CHARS = 340_000; // debe ser ≤ MAX_IMAGE_CHARS de api/generate.js
const OK_TYPES = /^image\/(png|jpeg|webp)$/;

function canvasOf(bmp, side) {
  const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k));
  c.height = Math.max(1, Math.round(bmp.height * k));
  return c;
}

/** File → data URL ligero. PNG si cabe (conserva transparencia); si no, JPEG con calidad decreciente. */
export async function prepareImage(file) {
  if (!OK_TYPES.test(file.type)) throw new Error('Solo PNG, JPG o WebP.');
  const bmp = await createImageBitmap(file);
  const attempts = [[MAX_SIDE, 'image/png'], [MAX_SIDE, 'image/jpeg', 0.9], [400, 'image/jpeg', 0.8], [320, 'image/jpeg', 0.7]];
  for (const [side, type, q] of attempts) {
    const c = canvasOf(bmp, side);
    const g = c.getContext('2d');
    if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); } // JPEG no tiene alfa
    g.drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL(type, q);
    if (url.length <= MAX_CHARS) return url;
  }
  throw new Error('La imagen es demasiado pesada. Prueba con una más simple.');
}

/** data URL → miniatura JPEG chica (para el carrito: no queremos 200 KB por línea). */
export function thumbnail(dataUrl, side = 120) {
  return new Promise(ok => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = canvasOf(img, side);
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.7));
      } catch { ok(''); } // canvas contaminado (imagen remota sin CORS): el carrito va sin miniatura
    };
    img.onerror = () => ok('');
    img.src = dataUrl;
  });
}
