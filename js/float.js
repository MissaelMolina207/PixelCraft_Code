// js/float.js — Burbuja flotante del Estudio IA (estilo Messenger) + panel de chat.
//
// Piezas y conceptos (versión junior):
//  1) ARRASTRE con Pointer Events: un solo API para mouse, dedo y lápiz.
//       pointerdown → setPointerCapture (el navegador sigue mandándonos eventos aunque el dedo salga de la burbuja)
//       pointermove → si te moviste más de 6 px es ARRASTRE; si no, es un TOQUE (así un toque abre el chat y no lo arrastra)
//       pointerup   → soltar. Si fue arrastre: imán al borde + guardar posición.
//     En CSS, `touch-action: none` evita que el navegador convierta el gesto en scroll de la página.
//  2) LÍMITES ESTRICTOS: clamp() en cada movimiento, al soltar y al cambiar el tamaño de la ventana. Imposible sacarla de pantalla.
//  3) La posición se guarda como PROPORCIÓN (0–1) del espacio libre: sobrevive a rotar el celular o redimensionar la ventana.
//  4) Tips aleatorios con "bolsa mezclada" (nadie repite hasta agotar todos), pausa en pestaña oculta, tope por sesión y botón
//     "No más tips" (se acuerda 7 días). Nada de molestar sin salida.
//  5) Panel: nace desde la burbuja (transform-origin), Esc/clic fuera/✕ cierran, el foco entra y vuelve, y Tab no se escapa.
import { $ } from './utils.js';
import { store } from './store.js';
import { iconSvg } from './icons.js';

const SIZE = 60, MARGIN = 8, DOCK_GAP = 14, FAB = 56, FAB_MARGIN = 16;
const POS_KEY = 'pc-bubble', MUTE_KEY = 'pc-tips-mute';
const SNAP_PX = 96;                    // a menos de esto de un borde, la burbuja se "pega" al soltarla
const MAX_TIPS = 12;                   // tope por sesión
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const FOCUSABLE = 'a[href], button:not([disabled]), select, input, textarea, [tabindex]:not([tabindex="-1"])';

const S = { x: 0, y: 0, user: false, start: null, moved: false, open: false, queue: [], last: '', shown: 0, timers: {}, messages: [], lastFocus: null };
let bubble, tip, panel, scrim;

// ------------------------------------------------------------------ geometría
const vw = () => document.documentElement.clientWidth;
const vh = () => window.innerHeight;
const safeBottom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;

const bounds = () => ({ minX: MARGIN, maxX: vw() - SIZE - MARGIN, minY: MARGIN, maxY: vh() - SIZE - MARGIN });

/** Posición inicial: centrada justo ENCIMA del botón de WhatsApp. */
function dockPos() {
  return { x: vw() - FAB_MARGIN - FAB / 2 - SIZE / 2, y: vh() - FAB_MARGIN - safeBottom() - FAB - DOCK_GAP - SIZE };
}

function place(x, y) {
  const b = bounds();
  S.x = clamp(x, b.minX, b.maxX);
  S.y = clamp(y, b.minY, b.maxY);
  bubble.style.setProperty('--bx', `${S.x}px`);
  bubble.style.setProperty('--by', `${S.y}px`);
}

function persist() {
  const b = bounds();
  try { localStorage.setItem(POS_KEY, JSON.stringify({ rx: (S.x - b.minX) / Math.max(1, b.maxX - b.minX), ry: (S.y - b.minY) / Math.max(1, b.maxY - b.minY) })); } catch { /* sin storage */ }
}

function restore() {
  try {
    const s = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
    if (s && Number.isFinite(s.rx) && Number.isFinite(s.ry)) {
      const b = bounds();
      S.user = true;
      return place(b.minX + s.rx * (b.maxX - b.minX), b.minY + s.ry * (b.maxY - b.minY));
    }
  } catch { /* JSON corrupto: se ignora */ }
  const d = dockPos();
  place(d.x, d.y);
}

/** Imán: si quedó cerca de un borde lateral, se pega con una animación corta. */
function snap() {
  const b = bounds();
  let x = S.x;
  if (S.x - b.minX < SNAP_PX) x = b.minX; else if (b.maxX - S.x < SNAP_PX) x = b.maxX;
  if (x === S.x) return;
  bubble.classList.add('snap');
  place(x, S.y);
  setTimeout(() => bubble.classList.remove('snap'), 320);
}

// ------------------------------------------------------------------ tips
const muted = () => { try { return Number(localStorage.getItem(MUTE_KEY) || 0) > Date.now(); } catch { return false; } };

/** Bolsa mezclada: todos los mensajes salen una vez antes de repetirse. */
function nextMessage() {
  if (!S.queue.length) {
    S.queue = [...S.messages].sort(() => Math.random() - 0.5);
    if (S.queue.length > 1 && S.queue.at(-1) === S.last) S.queue.unshift(S.queue.pop()); // no repetir el último al rellenar
  }
  return (S.last = S.queue.pop() || '');
}

function placeTip() {
  const tw = tip.offsetWidth, th = tip.offsetHeight, cx = S.x + SIZE / 2, cy = S.y + SIZE / 2, gap = 14;
  let side, tx, ty;
  const fits = (x, y) => x >= MARGIN && y >= MARGIN && x + tw <= vw() - MARGIN && y + th <= vh() - MARGIN;
  const tries = cx > vw() / 2
    ? [['left', S.x - tw - gap, cy - th / 2], ['top', cx - tw / 2, S.y - th - gap], ['bottom', cx - tw / 2, S.y + SIZE + gap], ['right', S.x + SIZE + gap, cy - th / 2]]
    : [['right', S.x + SIZE + gap, cy - th / 2], ['top', cx - tw / 2, S.y - th - gap], ['bottom', cx - tw / 2, S.y + SIZE + gap], ['left', S.x - tw - gap, cy - th / 2]];
  const pick = tries.find(([, x, y]) => fits(x, clamp(y, MARGIN, vh() - th - MARGIN))) || tries[1];
  [side, tx, ty] = pick;
  tx = clamp(tx, MARGIN, vw() - tw - MARGIN);
  ty = clamp(ty, MARGIN, vh() - th - MARGIN);
  tip.dataset.side = side;
  tip.style.setProperty('--tx', `${tx}px`);
  tip.style.setProperty('--ty', `${ty}px`);
  tip.style.setProperty('--ax', `${clamp(cx - tx - 6, 14, tw - 26)}px`); // la colita apunta al centro de la burbuja
}

function hideTip() { clearTimeout(S.timers.hide); tip.hidden = true; }

function showTip() {
  if (S.open || S.start || document.hidden || muted() || !S.messages.length || document.body.classList.contains('no-scroll')) return scheduleTip();
  $('#bubbleTipText').textContent = nextMessage();
  tip.hidden = false;
  placeTip();
  $('#bubbleDot').hidden = false;
  nudge();
  S.shown++;
  clearTimeout(S.timers.hide);
  S.timers.hide = setTimeout(hideTip, 8500);
  if (S.shown < MAX_TIPS) scheduleTip();
}

function scheduleTip(first = false) {
  clearTimeout(S.timers.tip);
  if (muted() || S.shown >= MAX_TIPS) return;
  S.timers.tip = setTimeout(showTip, first ? rand(7000, 12000) : rand(20000, 45000));
}

function nudge() {
  if (reduceMotion()) return;
  bubble.classList.remove('nudge');
  void bubble.offsetWidth;                                   // truco: forzar reflow para poder repetir la animación
  bubble.classList.add('nudge');
  setTimeout(() => bubble.classList.remove('nudge'), 1000);
}
function scheduleNudge() {
  clearTimeout(S.timers.nudge);
  S.timers.nudge = setTimeout(() => { if (!S.open && !S.start && !document.hidden && tip.hidden) nudge(); scheduleNudge(); }, rand(14000, 26000));
}

// ------------------------------------------------------------------ panel
function trapTab(e) {
  if (e.key !== 'Tab') return;
  const items = [...panel.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items.at(-1);
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
const onKey = e => { if (e.key === 'Escape') closePanel(); else trapTab(e); };

export function openStudio({ prompt } = {}) {
  const input = $('#chatInput');
  if (prompt && input) { input.value = prompt; input.dispatchEvent(new Event('input')); }
  if (S.open) return input?.focus();
  S.open = true;
  S.lastFocus = document.activeElement;
  hideTip();
  $('#bubbleDot').hidden = true;
  panel.hidden = false;
  scrim.hidden = false;
  // El panel "nace" de la burbuja: su transform-origin es el centro de la burbuja, medido relativo al panel.
  const r = bubble.getBoundingClientRect(), p = panel.getBoundingClientRect();
  panel.style.setProperty('--ox', `${r.left + r.width / 2 - p.left}px`);
  panel.style.setProperty('--oy', `${r.top + r.height / 2 - p.top}px`);
  requestAnimationFrame(() => { panel.classList.add('open'); scrim.classList.add('show'); });
  document.body.classList.add('studio-open', 'no-scroll');
  bubble.setAttribute('aria-expanded', 'true');
  document.addEventListener('keydown', onKey);
  setTimeout(() => { $('#chatLog')?.scrollTo({ top: 1e9 }); input?.focus({ preventScroll: true }); }, reduceMotion() ? 0 : 120);
}

export function closePanel() {
  if (!S.open) return;
  S.open = false;
  panel.classList.remove('open');
  scrim.classList.remove('show');
  document.body.classList.remove('studio-open', 'no-scroll');
  bubble.setAttribute('aria-expanded', 'false');
  document.removeEventListener('keydown', onKey);
  const done = () => { if (!S.open) { panel.hidden = true; scrim.hidden = true; } };
  reduceMotion() ? done() : setTimeout(done, 300);
  (S.lastFocus && document.contains(S.lastFocus) ? S.lastFocus : bubble).focus?.({ preventScroll: true });
  scheduleTip();
}

const toggle = () => (S.open ? closePanel() : openStudio());

// ------------------------------------------------------------------ arranque
/** El contenido (mensajes, logo) llega por red y puede tardar: la burbuja ya funciona y se completa cuando llega. */
export function setBubbleContent(content) {
  const b = content?.bubble;
  if (!b) return;
  S.messages = [...b.tips, ...b.ads, ...b.recs, ...b.jokes].filter(Boolean);
  S.queue = [];
  const logo = $('#bubbleLogo');
  if (b.logo) {
    const img = document.createElement('img');
    img.alt = '';
    img.src = b.logo;
    img.onerror = () => { logo.innerHTML = iconSvg('sparkle', 28); };   // si el logo no carga, vuelve el destello
    logo.replaceChildren(img);
  } else logo.innerHTML = iconSvg('sparkle', 28);
}

export function initFloat() {
  bubble = $('#studioBubble'); tip = $('#bubbleTip'); panel = $('#studioPanel'); scrim = $('#studioScrim');
  if (!bubble || !panel) return;
  setBubbleContent(store.content);
  document.addEventListener('content:ready', e => setBubbleContent(e.detail));

  // Medida del safe-area inferior (iPhone) en px, para colocar la burbuja encima del botón de WhatsApp
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);visibility:hidden';
  document.body.append(probe);
  document.documentElement.style.setProperty('--sab', `${probe.offsetHeight}`);
  probe.remove();
  restore();

  // --- arrastre ---
  bubble.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    S.start = { px: e.clientX, py: e.clientY, x: S.x, y: S.y };
    S.moved = false;
    try { bubble.setPointerCapture(e.pointerId); } catch { /* puntero sintético o ya liberado: el arrastre sigue funcionando sin captura */ }
  });
  bubble.addEventListener('pointermove', e => {
    if (!S.start) return;
    const dx = e.clientX - S.start.px, dy = e.clientY - S.start.py;
    if (!S.moved && Math.hypot(dx, dy) > 6) { S.moved = true; bubble.classList.add('dragging'); hideTip(); }
    if (S.moved) place(S.start.x + dx, S.start.y + dy);
  });
  const end = e => {
    if (!S.start) return;
    bubble.classList.remove('dragging');
    const wasDrag = S.moved;
    S.start = null;
    if (wasDrag) { S.user = true; snap(); persist(); }
    else if (e.type === 'pointerup') toggle();      // un toque corto = abrir/cerrar
  };
  bubble.addEventListener('pointerup', end);
  bubble.addEventListener('pointercancel', end);
  bubble.addEventListener('click', e => { if (e.detail === 0) toggle(); });  // teclado: Enter / Espacio
  bubble.addEventListener('keydown', e => {                                // flechas mueven la burbuja (accesibilidad)
    const step = e.shiftKey ? 48 : 16, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    place(S.x + d[0], S.y + d[1]); S.user = true; persist(); hideTip();
  });
  addEventListener('resize', () => { if (S.user) restore(); else { const d = dockPos(); place(d.x, d.y); } if (!tip.hidden) placeTip(); });

  // --- tips ---
  $('#bubbleTipX').addEventListener('click', hideTip);
  $('#bubbleTipOpen').addEventListener('click', () => openStudio());
  $('#bubbleTipMute').addEventListener('click', () => {
    try { localStorage.setItem(MUTE_KEY, String(Date.now() + 7 * 864e5)); } catch { /* idem */ }
    hideTip();
    clearTimeout(S.timers.tip);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) hideTip(); });
  scheduleTip(true);
  scheduleNudge();

  // --- abrir el panel desde cualquier lado ---
  $('#studioClose').addEventListener('click', closePanel);
  scrim.addEventListener('click', closePanel);
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-open-studio]');
    if (t) { e.preventDefault(); openStudio(); }
  });
  document.addEventListener('studio:open', e => openStudio(e.detail));
  if (location.hash === '#estudio') openStudio();
  addEventListener('hashchange', () => { if (location.hash === '#estudio') openStudio(); });
}
