# The Figure — AI Fitting Room

A responsive virtual try-on demo for **The Figure**, powered by Decart's Lucy Virtual Try-On model.

Repository: <https://github.com/utkarshdhoundiyal-pearlquest/The-Figure--Demo>

## What the demo includes

- Ten garment presets from Decart's public Lucy prompt gallery
- A guided 2–3 outfit selection flow
- Camera support for mobile, tablet, laptop, and desktop browsers
- Live Lucy Virtual Try-On 3.6 streaming when a Decart API key is configured
- Camera-only fallback mode when the AI service is not configured
- Zero-credit camera preview before the visitor explicitly starts AI
- One 30-second standard-mode AI demo per fitting-room visit (about 60 Decart credits maximum)
- Automatic AI disconnect when the timer ends, the user stops it, the stream errors, or the tab is hidden
- Live outfit switching without restarting the session
- Photo capture, JPG download, and a print-friendly sticker sheet
- Responsive layouts for retail kiosks and personal devices

## Run locally

Requirements: Node.js 22.13+ and pnpm 11.25+.

```bash
pnpm install
pnpm dev
```

Open the local URL printed by the development server. Camera access requires localhost or HTTPS.

## Connect Decart / Lucy

1. Create a Decart API key at `https://platform.decart.ai/api-keys`.
2. Copy `.env.example` to `.env.local`.
3. Set `DECART_API_KEY` in `.env.local`.
4. Restart the development server.

The permanent key is used only by `app/api/realtime-token/route.ts`. The browser receives a 60-second token restricted to `lucy-vton-3.6`, the current origin, and a server-enforced 35-second realtime ceiling. The UI stops generation after 30 seconds or immediately after the photo. Never expose the permanent key in client-side code.

Without a key, the entire selection, camera, capture, download, and print flow still works in preview mode; only the AI garment transformation is disabled.

## Production build

```bash
pnpm build
pnpm start
```

Configure `DECART_API_KEY` as a server-side secret in the hosting environment before deployment.

## Deploy to Vercel through GitHub only

Production is connected to the GitHub repository. Do not use `vercel deploy` or upload the source directly.

1. Push changes to the GitHub repository.
2. Let the Vercel Git integration build the commit.
3. Add `DECART_API_KEY` under **Project Settings → Environment Variables** for Production, Preview, and Development.
4. Redeploy the latest Git commit after saving the variable.

OpenRouter is not required. The browser connects to Lucy through Decart's JavaScript SDK and receives only a short-lived client token from `/api/realtime-token`.

## Vercel usage profile

This repository intentionally does not enable Vercel Analytics, Speed Insights, Image Optimization, cron jobs, storage, databases, AI Gateway, or Marketplace integrations. The page itself is statically generated and remote garment images bypass Vercel Image Optimization.

The only dynamic Vercel resource is `/api/realtime-token`, a small Function required to keep the permanent Decart key secret. It is not called when the page or camera preview opens; it runs only when a visitor deliberately starts the capped AI demo and has a 5-second maximum duration. Function requests, builds, edge requests, and bandwidth are still metered by Vercel, so repository code alone cannot guarantee literal zero usage or a zero-dollar overage. Configure Vercel Spend Management with an automatic pause action if the team must enforce a hard spending limit.
