# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Live Stocks (`/stocks`)

The `/stocks` page renders a candlestick chart with hourly OHLC data plus a live-ish price ticker.

- **Historical bars** come from Yahoo Finance's public chart endpoint (no API key needed). It's an undocumented endpoint, so it may break if Yahoo changes the response shape.
- **Live quotes** come from [Finnhub](https://finnhub.io/) and require a free API key.

### Running locally

1. Get a free API key at https://finnhub.io/register (Dashboard → API Key).
2. Copy the example env file and paste your key:
   ```sh
   cp .env.example .env
   # edit .env and set FINNHUB_API_KEY=...
   ```
3. Install [Netlify CLI](https://docs.netlify.com/cli/get-started/) if you don't have it, then run the dev server (it loads `.env` and serves the functions alongside Vite):
   ```sh
   npx netlify dev
   ```
4. Visit `http://localhost:8888/stocks`.

`vite dev` alone won't work for the stocks page because it doesn't run the Netlify Functions that proxy Finnhub. The Finnhub key is read server-side only and is never sent to the browser.

### Endpoints

- `GET /.netlify/functions/stocks-history?symbol=AAPL` &mdash; ~1 month of hourly OHLC bars (5-minute in-memory cache).
- `GET /.netlify/functions/stocks-quote?symbol=AAPL` &mdash; current price, change, change %, timestamp.

## Account / Google Sign-In

The site supports Google sign-in. By default any signed-in user gets a no-op session; only the owner email (`OWNER_EMAIL`) gets `isOwner: true`, which unlocks the **Travel Plans** menu and the `/travel-plans` CRUD endpoints.

### One-time setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) &rarr; APIs &amp; Services &rarr; Credentials.
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. Set Authorized JavaScript origins:
   - `http://localhost:8888` (Netlify Dev)
   - `https://sacor.xyz` (production)
4. Copy the Client ID into both `VITE_GOOGLE_CLIENT_ID` (frontend) and `GOOGLE_CLIENT_ID` (backend, used to verify the `aud` claim). They are the same value &mdash; the `VITE_` prefix exposes it to the browser bundle.
5. Set `OWNER_EMAIL` to the Google account email that should unlock Travel Plans.
6. Generate a session secret and set `SESSION_SECRET`:
   ```sh
   openssl rand -hex 32
   ```
7. Mirror the four vars into Netlify (Site settings &rarr; Environment variables) for production.

### Endpoints

- `POST /.netlify/functions/auth-google` &mdash; verifies a Google ID token and sets the session cookie.
- `GET  /.netlify/functions/auth-me` &mdash; returns `{ user: { email, isOwner } | null }`.
- `POST /.netlify/functions/auth-logout` &mdash; clears the session cookie.
- `GET|POST|PUT|DELETE /.netlify/functions/travel-plans[?id=...]` &mdash; CRUD for travel plans, owner-only. Plans are stored in Netlify Blobs (`travel-plans` store) as markdown.
