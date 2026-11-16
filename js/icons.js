// js/icons.js — Iconos en el navegador. El registro vive en lib/icons.js (compartido con el servidor).
import { ICONS, ICON_NAMES, iconSvg } from '../lib/icons.js';
export { ICONS, ICON_NAMES, iconSvg };

/** Devuelve un <span class="ico-wrap"> con el icono (nodo DOM, listo para append). */
export function icon(name, size = 20) {
  const s = document.createElement('span');
  s.className = 'ico-wrap';
  s.innerHTML = iconSvg(name, size); // seguro: iconSvg solo usa paths del registro
  return s;
}

/** Reemplaza todos los <i data-icon="nombre"> del documento por su SVG (para HTML estático). */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(n => {
    n.innerHTML = iconSvg(n.dataset.icon, Number(n.dataset.size) || 20);
    n.classList.add('ico-wrap');
    n.removeAttribute('data-icon');
  });
}
