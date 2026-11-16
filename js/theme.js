// js/theme.js — Tema claro / oscuro / sistema.
//
// Cómo funciona (versión junior):
//  • Guardamos la elección en localStorage: 'light' | 'dark' | 'system' (por defecto 'system').
//  • 'light' y 'dark' ponen <html data-theme="…">. tokens.css lo traduce a `color-scheme`, y todos los colores cambian solos.
//  • 'system' QUITA el atributo: el navegador decide según el sistema operativo (y reacciona si el usuario lo cambia).
//  • Un script de 1 línea en el <head> aplica el tema ANTES de pintar para que no haya "parpadeo" blanco→negro.
//  • Cualquier botón con [data-theme-set="light|dark|system"] fija el tema; [data-theme-cycle] va rotando.
import { iconSvg } from './icons.js';

const KEY = 'pc-theme';
const MODES = ['system', 'light', 'dark'];
const LABEL = { system: 'Sistema', light: 'Claro', dark: 'Oscuro' };
const ICON = { system: 'monitor', light: 'sun', dark: 'moon' };

export const getTheme = () => { try { const v = localStorage.getItem(KEY); return MODES.includes(v) ? v : 'system'; } catch { return 'system'; } };

/** El tema que se ve de verdad ('light' | 'dark'), aunque la elección sea 'system'. */
export const resolved = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

export function setTheme(mode) {
  if (!MODES.includes(mode)) mode = 'system';
  try { mode === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, mode); } catch { /* modo privado: el tema dura la sesión */ }
  if (mode === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = mode;
  paint(mode);
  document.dispatchEvent(new CustomEvent('themechange', { detail: { mode, resolved: resolved() } }));
}

/** Sincroniza botones: estado visual, aria y el icono del botón cíclico. */
function paint(mode) {
  document.querySelectorAll('[data-theme-set]').forEach(b => {
    const on = b.dataset.themeSet === mode;
    b.setAttribute('aria-checked', String(on));
    b.classList.toggle('on', on);
  });
  document.querySelectorAll('[data-theme-cycle]').forEach(b => {
    b.innerHTML = iconSvg(ICON[mode], 20);
    b.setAttribute('aria-label', `Tema: ${LABEL[mode]}. Toca para cambiar`);
    b.title = `Tema: ${LABEL[mode]}`;
  });
}

export function initTheme() {
  const mode = getTheme();
  if (mode !== 'system') document.documentElement.dataset.theme = mode;
  document.addEventListener('click', e => {
    const set = e.target.closest('[data-theme-set]');
    if (set) return setTheme(set.dataset.themeSet);
    if (e.target.closest('[data-theme-cycle]')) setTheme(MODES[(MODES.indexOf(getTheme()) + 1) % MODES.length]);
  });
  paint(mode);
  // En "Sistema", si cambias el modo del sistema operativo la página lo sigue sin recargar (los colores cambian solos por CSS).
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => document.dispatchEvent(new CustomEvent('themechange', { detail: { mode: getTheme(), resolved: resolved() } })));
}
