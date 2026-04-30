# sacor.xyz

Personal homepage with a loud late-90s/GeoCities aesthetic. Built with React 19 + Vite, deployed on Netlify, with a handful of serverless functions backing the dynamic bits.

## Pages

Most pages are static React (home, blog index/post, contact, guestbook, MTS, webring, YtMp4). Two pages need backend setup to work end-to-end:

- `/stocks` — candlestick chart + live price ticker (see below).
- `/travel-plans` — allowlisted markdown CRUD (see below).

## Scripts

- `npm run dev` — Vite dev server (no Netlify Functions; `/stocks` and `/travel-plans` won't work).
- `npx netlify dev` — Vite + Functions on `http://localhost:8888`.
- `npm run build` / `npm run preview` / `npm run lint`.

## Live Stocks (`/stocks`)

The `/stocks` page renders a candlestick chart with hourly OHLC data plus a live-ish price ticker.

- **Historical bars** try Yahoo Finance's undocumented public chart endpoint first (two hosts), then fall back to [Finnhub](https://finnhub.io/) if Yahoo fails. Yahoo doesn't need a key; the Finnhub fallback uses the same `FINNHUB_API_KEY` as live quotes.
- **Live quotes** come from Finnhub and require a free API key.

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

## Other Endpoints

- `GET /.netlify/functions/substack-feed` &mdash; merged Substack RSS feed used by the blog index, sorted newest-first (30-minute in-memory cache, returns the previous payload on upstream failure). The list of source feeds is hard-coded in [`netlify/functions/substack-feed.mjs`](netlify/functions/substack-feed.mjs).
- `GET|POST|DELETE /.netlify/functions/hit` &mdash; the GeoCities-style hit counter, backed by the Netlify Blobs `hits` store. `GET` reads the current count, `POST` increments, `DELETE` resets to 0.

## Account / Google Sign-In

The site supports Google sign-in. By default any signed-in user gets a no-op session; only emails listed in `TRAVEL_PLAN_EMAILS` can see the **Travel Plans** menu and use the `/travel-plans` CRUD endpoints. The server checks that allowlist on every protected request, so removing an email takes effect without waiting for old sessions to expire.

### One-time setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) &rarr; APIs &amp; Services &rarr; Credentials.
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. Set Authorized JavaScript origins:
   - `http://localhost:8888` (Netlify Dev)
   - `https://sacor.xyz` (production)
4. Copy the Client ID into both `VITE_GOOGLE_CLIENT_ID` (frontend) and `GOOGLE_CLIENT_ID` (backend, used to verify the `aud` claim). They are the same value &mdash; the `VITE_` prefix exposes it to the browser bundle.
5. Set `TRAVEL_PLAN_EMAILS` to a comma-separated list of exact Google account emails that should unlock Travel Plans, for example `you@example.com,friend@example.com`. `OWNER_EMAIL` still works as a temporary single-account fallback, but `TRAVEL_PLAN_EMAILS` is preferred.
6. Generate a session secret and set `SESSION_SECRET`:
   ```sh
   openssl rand -hex 32
   ```
7. Mirror the required vars into Netlify (Site settings &rarr; Environment variables) for production: `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `TRAVEL_PLAN_EMAILS`, and `SESSION_SECRET`.
8. Redeploy the site after changing `VITE_GOOGLE_CLIENT_ID`; Vite bakes `VITE_` env vars into the frontend bundle at build time.

### Endpoints

- `POST /.netlify/functions/auth-google` &mdash; verifies a Google ID token and sets the session cookie.
- `GET  /.netlify/functions/auth-me` &mdash; returns `{ user: { email, canAccessTravelPlans, isOwner } | null, googleClientId }`. The `googleClientId` is echoed so the frontend can render the Google button without a separate config fetch.
- `POST /.netlify/functions/auth-logout` &mdash; clears the session cookie.
- `GET|POST|PUT|DELETE /.netlify/functions/travel-plans[?id=...]` &mdash; CRUD for travel plans, allowlisted accounts only. Plans live in the Netlify Blobs `travel-plans` store as JSON (`{ id, title, destination, body, createdAt, updatedAt }`, where `body` is markdown), with a separate `index` blob holding the summary list for the index view.
