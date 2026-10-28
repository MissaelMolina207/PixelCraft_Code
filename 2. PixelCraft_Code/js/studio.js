import { $, toast, wa, post } from './utils.js';
import { store } from './store.js';
import { addItem, openCart } from './cart.js';

const S = { art: null, prompt: '' };
let cv, cx;

function mock() {
  if (!cv || !cx) return;
  
  cx.fillStyle = '#15161a'; 
  cx.fillRect(0, 0, 480, 480);

  if (S.art) {
    cx.drawImage(S.art, 0, 0, cv.width, cv.height);
  } else {
    cx.fillStyle = 'rgba(247,248,251,.45)'; 
    cx.font = '600 15px system-ui'; 
    cx.textAlign = 'center'; 
    cx.fillText('Tu mockup fotorrealista aparecerá aquí', 240, 248); 
  }

  ['#buy', '#wa'].forEach(s => $(s).classList.toggle('off', !S.art));
  
  const msg = `Hola PixelCraft, quiero cotizar un diseño generado por IA.\n`
    + (S.prompt ? `Prompt: "${S.prompt}"\n` : '') + `Mockup: (adjunto en este chat)`;
  $('#wa').href = S.art ? wa(store.site.whatsapp, msg) : '#';
}

const toImage = src => new Promise((ok, no) => { 
  const i = new Image(); 
  i.crossOrigin = 'anonymous';
  i.onload = () => ok(i); 
  i.onerror = no; 
  i.src = src; 
});

async function generate(prompt) {
  try { 
    const res = await post('/api/generate', { prompt, productType: 'shirt' });
    if (res.imageUrl) {
      return await toImage(res.imageUrl);
    }
    throw new Error(res.error || 'No se obtuvo URL de imagen');
  } catch (e) { 
    console.error('Error al generar mockup con IA:', e);
    toast('Error al conectar con el motor de IA en Vercel.');
    return null; 
  }
}

export function initStudio() {
  cv = $('#cv'); 
  cx = cv.getContext('2d');
  
  const genBtn = $('#gen');
  if (genBtn) {
    genBtn.onclick = async () => {
      const p = $('#prompt').value.trim();
      if (p.length < 3) return toast('Escribe una idea válida para generar el diseño.');
      
      genBtn.disabled = true; 
      genBtn.textContent = 'Renderizando prenda real (IA)…';
      
      cx.fillStyle = '#15161a';
      cx.fillRect(0, 0, cv.width, cv.height);
      cx.fillStyle = '#ffffff';
      cx.font = '15px sans-serif';
      cx.textAlign = 'center';
      cx.fillText('Generando mockup fotorrealista...', cv.width / 2, cv.height / 2);

      try { 
        S.art = await generate(p); 
        if (!S.art) return; 
        S.prompt = p; 
        mock(); 
        toast('¡Mockup fotorrealista generado con éxito!');
      } catch (err) { 
        toast('Error al renderizar el diseño.'); 
      } finally { 
        genBtn.disabled = false; 
        genBtn.textContent = 'Generar diseño'; 
      }
    };
  }

  const buyBtn = $('#buy');
  if (buyBtn) {
    buyBtn.onclick = () => {
      if (!S.art) return;
      addItem({ id: 'ia-shirt', name: `Diseño IA (Playera)`, price: 350, img: cv.toDataURL('image/jpeg', .7) });
      openCart();
    };
  }
  
  mock();
}