// lib/icons.js — Registro ÚNICO de iconos (SVG de 24×24, trazo, heredan `currentColor` = se adaptan a claro/oscuro).
// Lo usan el navegador (js/icons.js) y el servidor (lib/content.js valida que el nombre exista).
// Para agregar uno: dibuja en una rejilla de 24×24, trazo de 1.8, y pega aquí el atributo `d` del <path>.
export const ICONS = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  cart: 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.5L20.5 8H6M9 20.5a.8.8 0 1 0 0-.01zM17 20.5a.8.8 0 1 0 0-.01z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  shirt: 'M8 3L3 6l2.5 4L8 9v12h8V9l2.5 1L21 6l-5-3a4 4 0 0 1-8 0z',
  hoodie: 'M8.5 4.5C9.5 3 10.7 2.5 12 2.5s2.5.5 3.5 2l5 2.5-2 4.5-3-1.2V21H8.5V12.3L5.5 13.5l-2-4.5zM10 5c.4 2 1 3 2 3s1.6-1 2-3',
  tie: 'M9 3h6l-1.2 4 2.2 11-4 3-4-3 2.2-11zM9 3l3 3 3-3',
  apron: 'M7 3h10v5l2.5 3.5V21h-15V11.5L7 8zM9 3v3M15 3v3',
  cap: 'M4 14a8 8 0 0 1 16 0zM20 14c1.8 0 3 .8 3 2.2H11M12 6V4',
  bag: 'M5 8h14l1 13H4zM9 8V6a3 3 0 0 1 6 0v2',
  mug: 'M4 6h12v8a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM16 8h2a2.5 2.5 0 0 1 0 5h-2',
  notebook: 'M6 3h12v18H6zM9 7h6M9 11h6M3 7h3M3 12h3M3 17h3',
  key: 'M8 11a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM11 12l9-9M16 7l3 3',
  printer: 'M7 9V3h10v6M6 18H4v-7h16v7h-2M7 14h10v7H7z',
  stamp: 'M9 14h6v-3a3 3 0 0 0 .5-5A3 3 0 1 0 8.5 6a3 3 0 0 0 .5 5zM5 17h14v3H5z',
  signpost: 'M12 3v18M5 5h12l3 3-3 3H5zM19 13H7l-3 3 3 3h12',
  plotter: 'M4 8h16v7H4zM7 15v5h10v-5M6 11h12',
  scissors: 'M6 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8 8l12 11M8 16L20 5',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  gift: 'M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  card: 'M3 6h18v12H3zM7 10h6M7 14h4M16 10h1',
  cube: 'M12 2l9 5v10l-9 5-9-5V7zM12 12l9-5M12 12L3 7M12 12v10',
  layers: 'M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5M10 14l2 2 3-3',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  truck: 'M3 6h11v10H3zM14 9h4l3 3v4h-7zM7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01',
  check: 'M5 12l4 4 10-10',
  palette: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.6-2.5H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5zM7.5 11h.01M11 7.5h.01M15.5 8h.01',
  chat: 'M4 5h16v11H9l-5 4z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  sparkle: 'M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8zM19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z',
  whatsapp: 'M21 12a9 9 0 0 1-13.4 7.8L3 21l1.3-4.4A9 9 0 1 1 21 12zM9.2 8.6c-.4 1.6.9 4 3 5.4 1.1.7 2.2.9 3 .6l.6-1.3-1.8-1-.9.7c-.9-.4-1.9-1.3-2.3-2.3l.7-.9-.9-1.8z',
  pin: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  'chevron-l': 'M15 6l-6 6 6 6',
  'chevron-r': 'M9 6l6 6-6 6',
  ruler: 'M3 17L17 3l4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  gauge: 'M4 18a8 8 0 1 1 16 0M12 18l4-6',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4'
};
export const ICON_NAMES = Object.keys(ICONS);

/** SVG como string. SOLO acepta nombres del registro: no hay forma de inyectar HTML por aquí. */
export const iconSvg = (name, size = 20) => {
  const d = ICONS[name] || ICONS.box;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
};
