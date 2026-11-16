// js/cart.js — Carrito lateral. Accesible: cerrado = `inert` (nada dentro se puede enfocar con Tab), Esc y clic en el fondo
// lo cierran, el foco entra al abrir y vuelve al botón al cerrar. Los textos se ESCAPAN (los nombres vienen del catálogo editable).
import { $, fmt, toast, post } from './utils.js';
import { store } from './store.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Solo imágenes conocidas: miniatura del Estudio (data URL), rutas del sitio o https. */
const safeImg = s => (/^(data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+|img\/[\w.\-\/]+|https:\/\/[^\s"'<>]+)$/.test(s || '') ? s : '');

let lastFocus = null;
const isOpen = () => $('#cart').classList.contains('open');

function setOpen(open) {
  const cart = $('#cart'), scrim = $('#cartScrim'), btn = $('#cartBtn');
  if (open === isOpen()) return;
  cart.classList.toggle('open', open);
  cart.inert = !open;
  btn?.setAttribute('aria-expanded', String(open));
  if (open) {
    lastFocus = document.activeElement;
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('show'));
    document.body.classList.add('no-scroll');
    $('#closeCart').focus();
  } else {
    scrim.classList.remove('show');
    setTimeout(() => { if (!isOpen()) scrim.hidden = true; }, 260);
    if (!document.body.classList.contains('studio-open')) document.body.classList.remove('no-scroll');
    (lastFocus && document.contains(lastFocus) ? lastFocus : btn)?.focus?.({ preventScroll: true });
  }
}

export function addItem(item) { store.cart.push(item); draw(); toast('Agregado: ' + item.name); }
export const openCart = () => setOpen(true);

function draw() {
  const c = store.cart;
  $('#count').textContent = c.length;
  $('#items').innerHTML = c.length
    ? c.map((i, k) => `<div class="item">${safeImg(i.img) ? `<img src="${safeImg(i.img)}" alt="">` : ''}<span>${esc(i.name)}<br><small>${fmt(i.price)}</small></span><button class="btn" data-rm="${k}" aria-label="Quitar ${esc(i.name)}">✕</button></div>`).join('')
    : '<p style="color:var(--muted)">Vacío. Como tu bandeja antes de lanzar la campaña.</p>';
  $('#total').textContent = 'Total: ' + fmt(c.reduce((s, i) => s + i.price, 0));
}

export function initCart() {
  draw();
  const btn = $('#cartBtn');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'cart');
  btn.onclick = () => setOpen(!isOpen());
  $('#closeCart').onclick = () => setOpen(false);
  $('#cartScrim').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) setOpen(false); });
  $('#items').onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { store.cart.splice(+b.dataset.rm, 1); draw(); } };
  $('#pay').onclick = async () => {
    if (!store.cart.length) return toast('Agrega algo primero.');
    try {
      // Solo viajan IDs: el servidor recalcula precios. El cliente nunca decide cuánto pagas.
      const { url } = await post('/api/checkout', { items: store.cart.map(i => i.id) });
      location.href = url;
    } catch { toast('Pagos aún no configurados. Cotiza por WhatsApp mientras tanto.'); }
  };
}
