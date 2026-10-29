// js/studio-ui.js — Vista del chat. SOLO DOM: no sabe de red, prompts ni WhatsApp.
// Todo texto del cliente o de la IA entra con textContent (nunca innerHTML): un prompt no puede inyectar HTML.
import { $ } from './utils.js';

/** Crea un nodo. Hijos string → nodos de texto (seguro contra XSS). */
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid);
  return n;
};

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const mimeOf = url => /^data:(image\/[a-z]+);/.exec(url)?.[1] || 'image/png';

/**
 * @param h  { onSend(text), onFiles(FileList), onRemoveRef(i), onReset() }
 */
export function createChatUI(h) {
  const root = $('#chat'), log = $('#chatLog'), form = $('#chatForm'), input = $('#chatInput');
  const tray = $('#chatTray'), file = $('#chatFile'), send = $('#chatSend'), attach = $('#chatAttach');
  const cta = $('#chatCta'), quote = $('#chatQuote'), ctaNote = $('#ctaNote'), badge = $('#chatBadge');

  const toEnd = () => log.scrollTo({ top: log.scrollHeight });
  const push = node => { log.append(node); toEnd(); return node; };
  const bubble = (role, ...kids) => el('div', { class: `chat-msg ${role}` },
    role === 'user' ? null : el('span', { class: 'chat-avatar', 'aria-hidden': 'true' }, 'PC'),
    el('div', { class: 'chat-bubble' }, kids));

  // ---------- Compositor ----------
  const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  input.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); h.onFiles(files); }
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text && !tray.children.length) return;
    input.value = '';
    grow();
    h.onSend(text);
  });
  attach.addEventListener('click', () => file.click());
  file.addEventListener('change', () => { h.onFiles([...file.files]); file.value = ''; });
  $('#chatReset').addEventListener('click', () => h.onReset());

  // Arrastrar y soltar sobre todo el chat
  ['dragenter', 'dragover'].forEach(ev => root.addEventListener(ev, e => { e.preventDefault(); root.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => root.addEventListener(ev, e => { e.preventDefault(); root.classList.remove('drag'); }));
  root.addEventListener('drop', e => h.onFiles([...(e.dataTransfer?.files || [])]));

  // ---------- API pública ----------
  return {
    focus: () => input.focus({ preventScroll: true }),
    clear: () => { log.replaceChildren(); },
    setBadge: text => { badge.textContent = text; },
    setBusy(on) { send.disabled = input.disabled = on; log.setAttribute('aria-busy', String(on)); },
    setAttachEnabled(on) { attach.hidden = !on; },
    disable(placeholder) { input.disabled = send.disabled = attach.disabled = true; input.placeholder = placeholder; },

    /** Bandeja de imágenes de referencia (persisten durante toda la conversación). */
    setTray(images) {
      tray.replaceChildren();
      tray.hidden = !images.length;
      if (!images.length) return;
      tray.append(el('small', {}, 'Tu arte:'));
      images.forEach((src, i) => tray.append(el('span', { class: 'chat-ref' },
        el('img', { src, alt: `Imagen ${i + 1}` }),
        el('button', { type: 'button', 'aria-label': `Quitar imagen ${i + 1}`, onclick: () => h.onRemoveRef(i) }, '✕'))));
    },

    addUser(text, images = []) {
      return push(bubble('user',
        images.length ? el('div', { class: 'chat-attached' }, images.map(src => el('img', { src, alt: 'Imagen adjunta' }))) : null,
        text ? el('p', {}, text) : null));
    },

    /**
     * @param m { text, image?, tag?, hd?, promptEn?, actions?: [{label, onClick, primary?}], chips?: [string], onChip(text) }
     */
    addBot(m) {
      const body = [el('p', {}, m.text)];
      if (m.image) {
        const ext = EXT[mimeOf(m.image)] || 'png';
        body.push(el('figure', { class: 'chat-shot' },
          el('img', { src: m.image, alt: 'Diseño generado por IA', loading: 'lazy' }),
          el('figcaption', {}, el('span', { class: `chat-tag${m.hd ? ' hd' : ''}` }, m.tag || 'Borrador'),
            m.hd ? 'Vista de alta calidad' : 'Vista previa: el arte final lo afinamos contigo')));
        body.push(el('div', { class: 'chat-actions' },
          el('a', { class: 'btn', href: m.image, download: `pixelcraft-diseno.${ext}` }, 'Descargar'),
          (m.actions || []).map(a => el('button', { class: `btn${a.primary ? ' red' : ''}`, type: 'button', onclick: a.onClick }, a.label))));
      }
      if (m.promptEn) body.push(el('details', { class: 'chat-prompt' }, el('summary', {}, 'Ver el prompt mejorado'), el('pre', {}, m.promptEn)));
      if (m.chips?.length) body.push(el('div', { class: 'chat-chips' },
        m.chips.map(c => el('button', { class: 'chat-chip', type: 'button', onclick: () => m.onChip(c) }, c))));
      return push(bubble(m.error ? 'bot err' : 'bot', body));
    },

    /** Indicador "escribiendo…". Devuelve { set(text), stop() }. */
    typing(text) {
      const label = el('span', {}, text);
      const node = push(bubble('bot',
        el('div', { class: 'chat-typing' }, el('span', { 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), label)));
      return { set: t => { label.textContent = t; }, stop: () => node.remove() };
    },

    /** Barra de cotización. href vacío = ocultar. */
    setCta({ href, note } = {}) {
      cta.hidden = !href;
      if (href) { quote.href = href; if (note) ctaNote.textContent = note; }
    },
    onQuote(fn) { quote.addEventListener('click', fn); }
  };
}
