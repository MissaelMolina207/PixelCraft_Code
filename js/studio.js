import { $, toast, wa, post } from './utils.js';
import { store } from './store.js';
import { addItem, openCart } from './cart.js';

// S.mode = cómo se hizo el arte actual (a: texto, b: fusión). Las pestañas solo cambian el panel.
const S = { mode: 'a', prod: 'shirt', art: null, refs: [], prompt: '' };
const PN = { shirt: 'Playera', plate: 'Placa o letrero' };
const SHIRT = new Path2D('M150 70 L100 95 L45 150 L85 190 L120 165 L120 400 L360 400 L360 165 L395 190 L435 150 L380 95 L330 70 C310 100 270 112 240 112 C210 112 170 100 150 70Z');
let cv, cx;

function mock() {
  if (!cv || !cx) return;
  cx.fillStyle = '#15161a'; cx.fillRect(0, 0, 480, 480);
  cx.fillStyle = '#2b2d34'; cx.strokeStyle = 'rgba(247,248,251,.18)'; cx.lineWidth = 2;
  
  if (S.prod === 'shirt') { 
    cx.fill(SHIRT); 
    cx.stroke(SHIRT); 
    if (S.art) cx.drawImage(S.art, 170, 150, 140, 140); 
  } else { 
    cx.beginPath(); 
    cx.roundRect(60, 130, 360, 220, 10); 
    cx.fill(); 
    cx.stroke(); 
    if (S.art) cx.drawImage(S.art, 150, 150, 180, 180); 
  }

  if (!S.art) { 
    cx.fillStyle = 'rgba(247,248,251,.45)'; 
    cx.font = '600 15px system-ui'; 
    cx.textAlign = 'center'; 
    cx.fillText('Tu diseño aparecerá aquí', 240, 248); 
  }

  ['#buy', '#wa'].forEach(s => $(s).classList.toggle('off', !S.art));
  
  const msg = `Hola PixelCraft, quiero cotizar una idea.\nProducto: ${PN[S.prod]}\nModo: ${S.mode === 'a' ? 'texto a imagen' : 'fusión de ' + S.refs.length + ' referencias'}\n`
    + (S.prompt ? `Prompt: "${S.prompt}"\n` : '') + `Mockup: (adjunto en este chat)`;
  $('#wa').href = S.art ? wa(store.site.whatsapp, msg) : '#';
}

/* ---- Generador Local Blindado contra Contexto Comercial ---- */
const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hash = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

function fakeIA(prompt) {
  const cleanPrompt = prompt.toLowerCase();
  
  // Filtro de seguridad y coherencia sin censura extrema (Eventos sociales permitidos)
  const banned = ['violencia', 'arma', 'sangre', 'nazi', 'explícito'];
  if (banned.some(word => cleanPrompt.includes(word))) {
    toast('Filtro Comercial: Evitemos contenido explícito o violento. Diseñemos algo apto para impresión.');
    return null;
  }

  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'), r = rng(hash(prompt));
  
  // Paleta de colores industrial orientada a estética profesional / eventos (bodas, despedidas, corporativo)
  const pal = ['#cd0000', '#ff0000', '#f7f8fb', '#0049cd', '#ffc107', '#28a745'];
  
  g.fillStyle = '#111216'; g.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 18; i++) {
    g.strokeStyle = g.fillStyle = pal[(r() * pal.length) | 0]; 
    g.globalAlpha = .4 + r() * .5; 
    g.lineWidth = 3 + r() * 12;
    const x = r() * 512, y = r() * 512, s = 40 + r() * 180; 
    g.beginPath();
    if (r() > .5) {
      g.arc(x, y, s, 0, Math.PI * 2);
    } else { 
      g.moveTo(x, y); 
      g.lineTo(x + (r() - .5) * 400, y + (r() - .5) * 400); 
    }
    r() > .5 ? g.fill() : g.stroke();
  }

  // Texto superpuesto estilizado simulando tipografía comercial o recuerdo de evento
  g.globalAlpha = 0.9;
  g.fillStyle = '#ffffff';
  g.font = 'bold 36px monospace';
  g.textAlign = 'center';
  g.fillText(prompt.toUpperCase().slice(0, 16), 256, 260);

  return c;
}

const toImage = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

async function generate(prompt) {
  try { 
    // Intento de conexión con backend remoto/real
    const res = await post('/api/generate', { prompt });
    return await toImage(res.image); 
  } catch (e) { 
    // Falló por entorno estático (Live Server / sin backend) → Forzamos el generador local inteligente
    console.warn('Backend no detectado. Activando simulador local de Estudio IA.');
    return fakeIA(prompt); 
  }
}

/* ---- Fusión de referencias (canvas, 100% cliente) ---- */
const readFile = f => new Promise(ok => { const r = new FileReader(); r.onload = () => toImage(r.result).then(ok); r.readAsDataURL(f); });
async function addFiles(fl) {
  const imgs = [...fl].filter(f => f.type.startsWith('image/'));
  S.refs = S.refs.concat(await Promise.all(imgs.map(readFile)));
  $('#refs').innerHTML = S.refs.map(i => `<img src="${i.src}" alt="Referencia">`).join('');
}
const cover = (g, i) => { const k = Math.max(512 / i.width, 512 / i.height), w = i.width * k, h = i.height * k; g.drawImage(i, (512 - w) / 2, (512 - h) / 2, w, h); };

export function initStudio() {
  cv = $('#cv'); cx = cv.getContext('2d');
  
  const pick = (box, attr, fn) => $(box).onclick = e => {
    const b = e.target.closest('[' + attr + ']'); if (!b) return;
    [...$(box).children].forEach(x => x.setAttribute('aria-pressed', x === b));
    fn(b.getAttribute(attr));
  };
  
  pick('#mode', 'data-m', m => { $('#pa').hidden = m !== 'a'; $('#pb').hidden = m !== 'b'; });
  pick('#prod', 'data-p', p => { S.prod = p; mock(); });

  $('#gen').onclick = async () => {
    const p = $('#prompt').value.trim(), btn = $('#gen');
    if (p.length < 3) return toast('Escribe una idea válida para generar el diseño.');
    
    btn.disabled = true; 
    btn.textContent = 'Generando vector…';
    
    try { 
      S.art = await generate(p); 
      if (!S.art) return; // Si el filtro de seguridad lo frenó
      S.mode = 'a'; 
      S.prompt = p; 
      mock(); 
      toast('¡Mockup generado con éxito!');
    } catch (err) { 
      toast('Error al renderizar el diseño localmente.'); 
    } finally { 
      btn.disabled = false; 
      btn.textContent = 'Generar diseño'; 
    }
  };

  const dz = $('#drop');
  $('#files').onchange = e => addFiles(e.target.files);
  ['dragenter', 'dragover'].forEach(v => dz.addEventListener(v, e => { e.preventDefault(); dz.classList.add('on'); }));
  ['dragleave', 'drop'].forEach(v => dz.addEventListener(v, e => { e.preventDefault(); dz.classList.remove('on'); }));
  dz.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  
  $('#fuse').onclick = () => {
    if (S.refs.length < 2) return toast('Necesitas al menos 2 imágenes para fusionar referencias.');
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d'); cover(g, S.refs[0]);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = $('#mix').value / 100;
    S.refs.slice(1).forEach(i => cover(g, i));
    S.art = c; S.mode = 'b'; S.prompt = ''; mock(); toast('Fusión de referencias aplicada.');
  };

  $('#buy').onclick = () => {
    if (!S.art) return;
    const id = S.prod === 'shirt' ? 'ia-shirt' : 'ia-plate';
    addItem({ id, name: `Diseño IA (${PN[S.prod]})`, price: 350, img: cv.toDataURL('image/jpeg', .7) });
    openCart();
  };
  
  mock();
}