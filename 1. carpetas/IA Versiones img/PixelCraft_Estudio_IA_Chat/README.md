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
