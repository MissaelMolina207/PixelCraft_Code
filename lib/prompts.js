// lib/prompts.js — Los prompts del taller. PURO: sin red, sin estado. Se edita aquí y solo aquí.
//
// Idea central: el LLM NO escribe el prompt final. Solo extrae un "brief" (producto, color, arte).
// El prompt final lo arma una PLANTILLA fija por producto (fondo gris, encuadre, luz).
// Resultado: mockups consistentes aunque el cliente escriba "una playera con un perro bien chido".

/** Productos del catálogo que el Estudio sabe presentar. `label` va en la cotización de WhatsApp. */
export const PRODUCTS = {
  playera:  { label: 'Playera',            shot: 'a {color} short-sleeve crew-neck cotton t-shirt, front view, laid flat and perfectly centered', place: 'centered on the chest' },
  sudadera: { label: 'Sudadera',           shot: 'a {color} pullover hoodie, front view, laid flat and perfectly centered', place: 'centered on the chest' },
  gorra:    { label: 'Gorra',              shot: 'a {color} six-panel baseball cap, three-quarter front view', place: 'on the front panel' },
  tote:     { label: 'Tote bag',           shot: 'a {color} canvas tote bag with two handles, laid flat and centered', place: 'centered on the front of the bag' },
  taza:     { label: 'Taza',               shot: 'a {color} glossy ceramic mug, handle on the right, slight three-quarter view', place: 'on the visible side of the mug' },
  llavero:  { label: 'Llavero 3D',         shot: 'a custom 3D-printed keychain with a metal ring, {color} plastic, close-up product view', place: 'as the shape and relief of the keychain itself' },
  letrero:  { label: 'Letrero 3D',         shot: 'a volumetric 3D sign with thick extruded lettering, {color} finish, mounted on a plain wall', place: 'as the sign lettering and logo' },
  acrilico: { label: 'Corte láser acrílico', shot: 'a laser-cut {color} acrylic piece with clean polished edges, standing upright on a surface', place: 'as the cut-out shape and engraved details' },
  sticker:  { label: 'Stickers troquelados', shot: 'a sheet of die-cut vinyl stickers with a white border around each design, flat lay', place: 'one design per sticker' },
  otro:     { label: 'Pieza personalizada', shot: 'a custom manufactured product, {color}', place: 'as the main feature of the product' }
};

export const PRODUCT_KEYS = Object.keys(PRODUCTS);

const BACKGROUND = 'on a solid light grey seamless studio background. Soft even studio lighting, realistic material texture, sharp focus, commercial e-commerce product photo. No person, no model, no hands, no extra objects, no watermark';

/**
 * Prompt FINAL para el motor de imágenes. Siempre en inglés (los modelos responden mejor).
 * @param spec  { product, color, artwork }
 * @param hasRef  true si el cliente adjuntó su arte (se referencia como "image 0")
 */
export function buildPrompt(spec, hasRef = false) {
  const p = PRODUCTS[spec.product] || PRODUCTS.otro;
  const shot = p.shot.replace('{color}', spec.color || 'white');
  const art = hasRef
    ? `Use the attached artwork (image 0) exactly as provided, ${p.place}. Keep its characters, colors, text and proportions unchanged. Remove its plain background so only the artwork appears applied to the product, with a realistic printed finish.` +
      (spec.artwork ? ` Customer notes: ${spec.artwork}` : '')
    : `The design, ${p.place}: ${spec.artwork}`;
  return `Product mockup photograph of ${shot}, ${BACKGROUND}. ${art}`;
}

/** Instrucciones del LLM. Inglés = más obediencia; la salida visible al cliente va en español. */
export const SYSTEM_PROMPT = `You are the design assistant of PixelCraft, a Mexican custom workshop: screen printing (t-shirts, hoodies, caps, tote bags, mugs), 3D printing (keychains, resin prototypes), laser-cut acrylic, volumetric 3D signs and die-cut stickers.
The customer writes in Spanish. Turn their latest message (plus the previous brief, if any) into ONE product brief.
Reply with ONLY a JSON object. No markdown, no commentary:
{
  "allowed": true or false,
  "reply": "Spanish, max 2 short sentences, warm and concrete. Say what you are about to show. Ask AT MOST ONE useful question (colors, text, style) only if it would clearly improve the result.",
  "product": one of ${JSON.stringify(PRODUCT_KEYS)},
  "color": "base color of the garment or object, in English (default \\"white\\" for garments)",
  "artwork": "English, 15-60 words. Precise description of the graphic or object details: subject, style (e.g. flat vector, retro, minimal), composition and a palette of at most 3-4 flat colors. Put any text the customer wants inside double quotes, spelled exactly as they wrote it. Never invent text they did not ask for.",
  "summary": "Spanish noun phrase, max 14 words, for the quote (e.g. Playera blanca con hot dog estilo retro)"
}
Rules:
- If a previous brief is given, KEEP its product, color and artwork unless the customer changes them. Apply edits as modifications ("hazlo rojo" changes the palette only).
- If the customer attached images, the attached image IS the artwork: describe only the requested changes or placement. Do not describe the image itself.
- Screen printing works best with simple bold shapes, few flat colors and no gradients; steer the artwork that way unless the customer asks otherwise.
- If the request is sexual, hateful or graphically violent, set "allowed" to false and write a polite Spanish refusal in "reply".
- If the customer asks for a trademarked character or brand logo, still make the brief, but add to "reply" one short sentence: PixelCraft only prints artwork the customer owns or is authorized to use.`;

// ---------- Plan B sin LLM (Cloudflare caído, sin cuota o sin credenciales) ----------
const PRODUCT_WORDS = [
  ['sudadera', /sudadera|hoodie|su[eé]ter/i], ['playera', /playera|camisa|camiseta|t-?shirt|remera/i],
  ['gorra', /gorra|cachucha|gorro/i], ['tote', /tote|bolsa|morral/i], ['taza', /taza|mug|tarro/i],
  ['llavero', /llavero|llaveros/i], ['letrero', /letrero|r[oó]tulo|anuncio luminoso/i],
  ['acrilico', /acr[ií]lico|l[aá]ser/i], ['sticker', /sticker|calcoman[ií]a|etiqueta|pegatina/i]
];
const COLOR_WORDS = [
  [/negr[ao]/i, 'black'], [/blanc[ao]/i, 'white'], [/roj[ao]/i, 'red'], [/azul/i, 'blue'], [/verde/i, 'green'],
  [/amarill[ao]/i, 'yellow'], [/gris/i, 'gray'], [/rosa|rosado/i, 'pink'], [/morad[ao]|violeta/i, 'purple'], [/naranja/i, 'orange']
];

/** Brief aproximado con regex. Peor que el LLM, mejor que fallar. */
export function heuristicSpec(text, prev = null) {
  const t = String(text || '');
  const product = PRODUCT_WORDS.find(([, re]) => re.test(t))?.[0] || prev?.product || 'otro';
  const color = COLOR_WORDS.find(([re]) => re.test(t))?.[1] || prev?.color || 'white';
  // Sin LLM no hay traducción: el texto del cliente va tal cual (FLUX.2 y Gemini entienden español razonablemente).
  const artwork = prev?.artwork ? `${prev.artwork}. Change requested: ${t}` : t;
  return {
    allowed: true,
    reply: 'Listo, aquí tienes una primera versión. Dime qué le cambiamos.',
    product, color, artwork,
    summary: `${PRODUCTS[product].label}: ${t}`.slice(0, 100)
  };
}

const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Valida/sanea la salida del LLM. Nunca confiamos en su formato. */
export function normalizeSpec(raw, text, prev = null) {
  const fb = heuristicSpec(text, prev);
  if (!raw || typeof raw !== 'object') return fb;
  const product = PRODUCT_KEYS.includes(raw.product) ? raw.product : fb.product;
  const color = /^[a-z][a-z \-]{1,23}$/i.test(str(raw.color, 24)) ? str(raw.color, 24).toLowerCase() : fb.color;
  return {
    allowed: raw.allowed !== false,
    reply: str(raw.reply, 320) || fb.reply,
    product, color,
    artwork: str(raw.artwork, 600) || fb.artwork,
    summary: str(raw.summary, 100) || fb.summary
  };
}

/** Mensajes para el LLM: reglas + brief previo + mensaje actual. */
export function buildMessages(text, { hasImages = false, prev = null } = {}) {
  const ctx = [
    prev ? `Previous brief: ${JSON.stringify({ product: prev.product, color: prev.color, artwork: prev.artwork })}` : 'Previous brief: none',
    `Attached images: ${hasImages ? 'yes (the customer attached their own artwork)' : 'none'}`,
    `Customer message: ${JSON.stringify(text)}`
  ].join('\n');
  return [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: ctx }];
}
