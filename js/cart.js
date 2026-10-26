import { $, fmt, toast, post } from './utils.js';
import { store } from './store.js';

export function addItem(item) { store.cart.push(item); draw(); toast('Agregado: ' + item.name); }
export const openCart = () => $('#cart').classList.add('open');

function draw() {
  const c = store.cart;
  $('#count').textContent = c.length;
  $('#items').innerHTML = c.length
    ? c.map((i, k) => `<div class="item">${i.img ? `<img src="${i.img}" alt="">` : ''}<span>${i.name}<br><small>${fmt(i.price)}</small></span><button class="btn" data-rm="${k}" aria-label="Quitar">✕</button></div>`).join('')
    : '<p style="color:var(--soft)">Vacío. Como tu bandeja antes de lanzar la campaña.</p>';
  $('#total').textContent = 'Total: ' + fmt(c.reduce((s, i) => s + i.price, 0));
}

export function initCart() {
  draw();
  $('#cartBtn').onclick = openCart;
  $('#closeCart').onclick = () => $('#cart').classList.remove('open');
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
