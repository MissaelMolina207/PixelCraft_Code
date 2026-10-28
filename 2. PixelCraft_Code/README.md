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
