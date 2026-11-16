// lib/content.js — Contenido editable del sitio: validador estricto + mezcla con los valores por defecto. PURO (sin red).
// Lo usan: api/site.js (público), lib/admin/settings.js (al guardar desde /admin) y los tests.
// Regla de seguridad: lo que se guarda aquí se PINTA en el sitio público, así que todo se valida y se acota.
import { ICON_NAMES } from './icons.js';
import { ValidationError } from './orders.js';

const LIMITS = { actions: [1, 3], badges: [0, 8], items: [1, 6], steps: [1, 6], msgs: [0, 40] };

const text = (max, label, { min = 0 } = {}) => v => {
  const s = String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
  if (s.length < min) throw new ValidationError(`${label}: escribe al menos ${min} caracteres`);
  return s;
};
const icon = label => v => { if (!ICON_NAMES.includes(v)) throw new ValidationError(`${label}: icono no válido`); return v; };

/** Enlaces permitidos: ancla (#contacto), página del sitio (rastreo.html#x) o https. Nada de javascript:, data: ni http. */
const href = label => v => {
  const s = String(v ?? '').trim();
  if (!/^(#[\w-]{1,40}|[a-z0-9._-]+\.html(#[\w-]{1,40})?|https:\/\/[^\s"'<>]{1,300})$/i.test(s)) throw new ValidationError(`${label}: usa un ancla (#contacto), una página (rastreo.html) o un enlace https://`);
  return s;
};
/** Imagen del logo: vacío, ruta del sitio (img/…) o https. */
const logo = v => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^https:\/\/[^\s"'<>]{1,300}$/.test(s)) return s;
  if (/^img\/[A-Za-z0-9._\-\/]{1,120}$/.test(s) && !s.includes('..')) return s;
  throw new ValidationError('Logo: usa una ruta como img/logo.png o un enlace https://');
};

function list(arr, [min, max], label, one) {
  if (!Array.isArray(arr)) throw new ValidationError(`${label}: formato no válido`);
  if (arr.length < min) throw new ValidationError(`${label}: agrega al menos ${min}`);
  if (arr.length > max) throw new ValidationError(`${label}: máximo ${max}`);
  return arr.map(one);
}
const messages = label => arr => list(arr, LIMITS.msgs, label, m => text(160, label)(m)).filter(Boolean);

/** Valida TODO el contenido. Lanza ValidationError con mensaje listo para mostrar. */
export function cleanContent(c) {
  if (!c || typeof c !== 'object') throw new ValidationError('Contenido no válido');
  const total = parseInt(c.capacity?.total, 10);
  if (!Number.isInteger(total) || total < 0 || total > 500) throw new ValidationError('Cupos totales: un entero entre 0 y 500');
  return {
    hero: {
      actions: list(c.hero?.actions, LIMITS.actions, 'Botones principales', (a, i) => {
        const kind = a?.kind === 'studio' ? 'studio' : 'link';
        return {
          label: text(40, `Botón ${i + 1}`, { min: 2 })(a?.label), kind,
          href: kind === 'link' ? href(`Botón ${i + 1}`)(a?.href) : '',
          style: a?.style === 'ghost' ? 'ghost' : 'red'
        };
      })
    },
    badges: list(c.badges, LIMITS.badges, 'Insignias', (b, i) => ({ icon: icon(`Insignia ${i + 1}`)(b?.icon), text: text(60, `Insignia ${i + 1}`, { min: 2 })(b?.text) })),
    capacity: { label: text(60, 'Etiqueta de cupos', { min: 2 })(c.capacity?.label), total },
    value: {
      title: text(80, 'Título de valor', { min: 2 })(c.value?.title), lead: text(200, 'Texto de valor')(c.value?.lead),
      items: list(c.value?.items, LIMITS.items, 'Tarjetas de valor', (it, i) => ({ icon: icon(`Tarjeta ${i + 1}`)(it?.icon), title: text(60, `Tarjeta ${i + 1}`, { min: 2 })(it?.title), text: text(300, `Tarjeta ${i + 1}`, { min: 2 })(it?.text) }))
    },
    process: {
      title: text(80, 'Título del proceso', { min: 2 })(c.process?.title), lead: text(200, 'Texto del proceso')(c.process?.lead),
      steps: list(c.process?.steps, LIMITS.steps, 'Pasos del proceso', (it, i) => ({ icon: icon(`Paso ${i + 1}`)(it?.icon), title: text(60, `Paso ${i + 1}`, { min: 2 })(it?.title), text: text(300, `Paso ${i + 1}`, { min: 2 })(it?.text) }))
    },
    bubble: {
      logo: logo(c.bubble?.logo),
      tips: messages('Tips')(c.bubble?.tips ?? []), ads: messages('Promociones')(c.bubble?.ads ?? []),
      recs: messages('Recomendaciones')(c.bubble?.recs ?? []), jokes: messages('Chistes')(c.bubble?.jokes ?? [])
    }
  };
}

/** Lo guardado manda; lo que falte (secciones nuevas en una versión futura) se completa con los defaults. */
export function mergeContent(defaults, saved) {
  const out = {};
  for (const k of Object.keys(defaults)) out[k] = saved && saved[k] && typeof saved[k] === 'object' ? { ...defaults[k], ...saved[k] } : defaults[k];
  if (Array.isArray(defaults.badges)) out.badges = Array.isArray(saved?.badges) ? saved.badges : defaults.badges;
  return out;
}

/** Cupos: disponibles = total − órdenes activas del taller. Nunca negativo; porcentaje de ocupación 0-100. */
export function capacityOf(total, used) {
  const t = Math.max(0, parseInt(total, 10) || 0), u = Math.max(0, parseInt(used, 10) || 0);
  return { total: t, used: u, available: Math.max(0, t - u), pct: t > 0 ? Math.min(100, Math.round((u / t) * 100)) : 0 };
}
