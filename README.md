# PixelCraft — El Laboratorio de la Casa

Landing One Page. Sin framework ni build: HTML + CSS + JS (módulos ES) + Vercel Functions.

```
index.html          # estructura de la página
css/                # tokens → base → components → responsive (en ese orden)
js/                 # main · store · utils · catalog · cart · studio · lead
api/                # generate (Replicate) · checkout (Stripe) · lead (n8n)
data/               # products.json y site.json: lo que editas sin tocar código
```

## Arranque
```bash
npm run static                   # ver el sitio (Estudio IA en modo simulado, sin pagos)
npx vercel link && npx vercel env pull .env.local
npm run dev                      # sitio + /api con tus llaves
```

Variables (ver `.env.example`): `REPLICATE_API_TOKEN`, `STRIPE_SECRET_KEY`, `N8N_LEAD_WEBHOOK`.
Nunca subas `.env*` a Git.


## Estudio IA (chat)

Frontend: `js/studio.js` (estado y negocio) · `js/studio-ui.js` (DOM) · `js/studio-images.js` (adjuntos) · `css/studio-chat.css`.
Backend: `api/generate.js` (un turno del chat) · `lib/prompts.js` (**aquí se editan los prompts del taller**) · `lib/refine.js` (LLM → brief) ·
`lib/cloudflare.js` / `lib/gemini.js` / `lib/replicate.js` (motores).

- Diagnóstico sin gastar crédito: `GET /api/generate` (capacidades) y `GET /api/generate?check=1`.
- Local: el API solo existe con `vercel dev`; con `npm run static` el chat carga pero responde 404.
- Antes de lanzar: pon el WhatsApp real en `data/site.json` (el actual es un placeholder).

## Rastreo y Admin

- **Público:** `rastreo.html` + `js/track.js` + `api/track.js`. Folio + últimos 4 dígitos del teléfono → timeline de 4 pasos. Solo devuelve la vista pública (`lib/orders.js → publicView`): sin costos, márgenes, notas ni ficha técnica.
- **Privado:** `admin.html` + `js/admin/*` + `api/admin.js` (un solo router: `?r=orders|products|employees|tasks|stats|init|login|logout|session`). Lógica en `lib/admin/*`.
- **Datos:** Cloudflare D1 por REST (`lib/db.js`, esquema en `lib/schema.js`). El catálogo vive en D1 y `data/products.json` queda de respaldo.
- **Primer uso:** configura las variables de `.env.example`, haz Redeploy, entra a `/admin` y pulsa «Inicializar base de datos».
- **Paqueterías:** `data/carriers.json` (plantillas de enlace de rastreo, edítalas sin tocar código).
- **Regla de oro:** nunca uses la etiqueta `<header>` dentro de componentes: `components.css` la fija arriba (`position: fixed`).
