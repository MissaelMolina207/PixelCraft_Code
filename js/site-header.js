// js/site-header.js — Comportamiento del header: drawer móvil, búsqueda, ubicación, scroll-spy y alto real (--header-h).
//
// Conceptos para junior:
//  • Drawer accesible = (1) botón con aria-expanded, (2) panel con `inert` cuando está cerrado (nadie puede tabular dentro
//    de algo invisible), (3) Esc y clic en el fondo lo cierran, (4) el foco entra al abrir y VUELVE al botón al cerrar,
//    (5) el fondo no hace scroll (body.no-scroll).
//  • ResizeObserver mide el header real y guarda su alto en la variable CSS --header-h; así los enlaces de ancla (#catalogo)
//    aterrizan justo debajo del header sin números mágicos.
//  • Scroll-spy: IntersectionObserver marca en el menú la sección que estás viendo.
import { $ } from './utils.js';

const FOCUSABLE = 'a[href], button:not([disabled]), select, input, textarea, [tabindex]:not([tabindex="-1"])';

export function initSiteHeader() {
  const header = $('#siteHeader'), burger = $('#burger'), drawer = $('#drawer'), scrim = $('#drawerScrim'), close = $('#drawerClose');
  if (!header) return;

  // --- Alto real del header → variable CSS ---
  const setH = () => document.documentElement.style.setProperty('--header-h', `${Math.round(header.getBoundingClientRect().height)}px`);
  setH();
  new ResizeObserver(setH).observe(header);

  // --- Drawer ---
  if (burger && drawer) {
    let lastFocus = null;
    const isOpen = () => drawer.classList.contains('open');
    const setOpen = open => {
      if (open === isOpen()) return;
      if (open) {
        lastFocus = document.activeElement;
        scrim.hidden = false;
        requestAnimationFrame(() => scrim.classList.add('show'));   // 2 pasos: primero existe, luego se anima
        drawer.inert = false;
        drawer.classList.add('open');
        document.body.classList.add('no-scroll');
        drawer.querySelector(FOCUSABLE)?.focus();
      } else {
        drawer.classList.remove('open');
        scrim.classList.remove('show');
        document.body.classList.remove('no-scroll');
        drawer.inert = true;
        setTimeout(() => { if (!isOpen()) scrim.hidden = true; }, 260);
        lastFocus?.focus?.();
      }
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    };
    burger.addEventListener('click', () => setOpen(!isOpen()));
    close.addEventListener('click', () => setOpen(false));
    scrim.addEventListener('click', () => setOpen(false));
    drawer.addEventListener('click', e => { if (e.target.closest('a[href]')) setOpen(false); });   // navegar cierra el menú
    document.addEventListener('keydown', e => {
      if (!isOpen()) return;
      if (e.key === 'Escape') return setOpen(false);
      if (e.key === 'Tab') {                                   // trampa de foco: Tab no se escapa del drawer
        const items = [...drawer.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null);
        const first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    matchMedia('(min-width: 900px)').addEventListener('change', e => { if (e.matches) setOpen(false); }); // al agrandar la ventana, no queda "abierto" oculto
  }

  // --- Ubicación: dos selectores (header y drawer) siempre sincronizados ---
  const loc = $('#loc'), locM = $('#locM');
  if (loc && locM) {
    const sync = from => { const v = from.value; (from === loc ? locM : loc).value = v; try { localStorage.setItem('pc-loc', v); } catch { /* sin storage: no pasa nada */ } };
    try { const v = localStorage.getItem('pc-loc'); if (v) { loc.value = v; locM.value = v; } } catch { /* idem */ }
    loc.addEventListener('change', () => sync(loc));
    locM.addEventListener('change', () => sync(locM));
  }

  // --- Búsqueda: Enter / lupa lleva al catálogo (el filtrado en vivo lo hace catalog.js con el evento input) ---
  $('#searchForm')?.addEventListener('submit', e => {
    e.preventDefault();
    $('#q').blur();
    $('#catalogo')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  // --- Scroll-spy ---
  const links = [...document.querySelectorAll('.hdr-nav a[href^="#"]')];
  const byId = Object.fromEntries(links.map(a => [a.getAttribute('href').slice(1), a]));
  const targets = Object.keys(byId).map(id => document.getElementById(id)).filter(Boolean);
  if (targets.length && 'IntersectionObserver' in window) {
    const visible = new Map();
    const io = new IntersectionObserver(entries => {
      for (const en of entries) en.isIntersecting ? visible.set(en.target.id, en.intersectionRatio) : visible.delete(en.target.id);
      const top = [...visible.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      links.forEach(a => a.removeAttribute('aria-current'));
      if (top) byId[top].setAttribute('aria-current', 'true');
    }, { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.1, 0.5, 1] });
    targets.forEach(t => io.observe(t));
  }
}
