import { $, toast, post } from './utils.js';
import { store } from './store.js';

export function initLead() {
  $('#lead').onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    if (d.web) return; // honeypot: los bots llenan campos ocultos
    try {
      await post('/api/lead', { ...d, origen: 'landing', cart: store.cart.map(i => i.id) });
      e.target.innerHTML = '<h3>Recibido. Te escribimos hoy.</h3><p style="color:var(--soft)">Si urge, WhatsApp es más rápido que cualquier formulario.</p>';
    } catch { toast('Falló el envío. Escríbenos por WhatsApp, no mordemos.'); }
  };
}
