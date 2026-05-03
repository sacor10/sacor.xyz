# sacor.xyz

Personal homepage with a loud late-90s/GeoCities aesthetic. Built with React 19 + Vite, deployed on Netlify, with a handful of serverless functions backing the dynamic bits.

## Pages

Most pages are static React (home, blog index/post, contact, guestbook, MTS, webring, YtMp4). A few pages need backend setup to work end-to-end:

- `/stocks` — candlestick chart + live price ticker (see below).
- `/travel-plans` — private and shared markdown itinerary CRUD (see below).

- `/instagram-downloader` - public Instagram Reel/post downloader backed by a separate Node API (see below).
- `/x-downloader` - public X/Twitter post video downloader backed by a separate Node API (see below).

## Scripts

- `npm run dev` — Vite dev server (no Netlify Functions; `/stocks` and `/travel-plans` won't work).
- `npx netlify dev` — Vite + Functions on `http://localhost:8888`.
- `npm run build` / `npm run preview` / `npm run lint`.

- `npm --prefix services/instagram-downloader run dev` - local Instagram downloader API on `http://localhost:8787`.
- `npm --prefix services/x-downloader run dev` - local X/Twitter downloader API on `http://localhost:8788`.

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
- `GET|PUT /.netlify/functions/stocks-pins` &mdash; signed-in user's pinned stock symbols, backed by Netlify Blobs.

## Other Endpoints

- `GET /.netlify/functions/substack-feed` &mdash; merged Substack RSS feed used by the blog index, sorted newest-first (30-minute in-memory cache, returns the previous payload on upstream failure). The list of source feeds is hard-coded in [`netlify/functions/substack-feed.mjs`](netlify/functions/substack-feed.mjs).
- `GET|POST|DELETE /.netlify/functions/hit` &mdash; the GeoCities-style hit counter, backed by the Netlify Blobs `hits` store. `GET` reads the current count, `POST` increments, `DELETE` resets to 0.

## Instagram Downloader

The `/instagram-downloader` page posts public Instagram Reel/post URLs to a dedicated Node service instead of a Netlify Function. This avoids Netlify's synchronous function response and duration limits for multi-video ZIP downloads.

### Running locally

1. Install the service dependencies:
   ```sh
   npm --prefix services/instagram-downloader install
   ```
2. Start the API:
   ```sh
   npm --prefix services/instagram-downloader run dev
   ```
3. In another terminal, run the site with `npm run dev` or `npx netlify dev` and visit `/instagram-downloader`.

### Config

- `VITE_INSTAGRAM_DOWNLOADER_API_URL` - browser-facing API base URL.
- `SITE_ORIGINS` - comma-separated CORS allowlist for the API.
- `PORT` - API port, default `8787`.
- `MAX_ITEMS` - maximum videos per post, default `20`.
- `EXTRACT_TIMEOUT_MS`, `MEDIA_TIMEOUT_MS`, `MAX_VIDEO_BYTES` - downloader guardrails.

### API

- `GET /healthz` - returns `{ ok: true }`.
- `POST /download` with JSON `{ "url": "https://www.instagram.com/reel/..." }` - returns one MP4 for a single public video or one ZIP for multiple public videos. Photo-only, private, login-required, or invalid URLs return JSON errors.

## X Downloader

The `/x-downloader` page posts public X/Twitter status URLs to a dedicated Node service. It follows the Instagram downloader service shape so larger multi-video ZIP responses do not run through Netlify Functions.

### Running locally

1. Install the service dependencies:
   ```sh
   npm --prefix services/x-downloader install
   ```
2. Start the API:
   ```sh
   npm --prefix services/x-downloader run dev
   ```
3. In another terminal, run the site with `npm run dev` or `npx netlify dev` and visit `/x-downloader`.

### Config

- `VITE_X_DOWNLOADER_API_URL` - browser-facing API base URL.
- `SITE_ORIGINS` - comma-separated CORS allowlist for the API.
- `PORT` - API port, default `8788`.
- `MAX_ITEMS` - maximum videos per post, default `20`.
- `EXTRACT_TIMEOUT_MS`, `MEDIA_TIMEOUT_MS`, `MAX_VIDEO_BYTES` - downloader guardrails.

### API

- `GET /healthz` - returns `{ ok: true }`.
- `POST /download` with JSON `{ "url": "https://x.com/user/status/123..." }` - returns one MP4 for a single public video or one ZIP for multiple public videos. Image-only, private, login-required, or invalid URLs return JSON errors.

## Account / Google Sign-In

The site supports Google sign-in. Any signed-in Google account can create and manage its own Travel Plans, and can also access plans shared with that exact email address.

### One-time setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) &rarr; APIs &amp; Services &rarr; Credentials.
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. Set Authorized JavaScript origins:
   - `http://localhost:8888` (Netlify Dev)
   - `https://sacor.xyz` (production)
4. Copy the Client ID into both `VITE_GOOGLE_CLIENT_ID` (frontend) and `GOOGLE_CLIENT_ID` (backend, used to verify the `aud` claim). They are the same value &mdash; the `VITE_` prefix exposes it to the browser bundle.
5. Optional: set `TRAVEL_PLAN_EMAILS` to a comma-separated list of exact Google account emails to mark as site owner accounts, for example `you@example.com,friend@example.com`. `OWNER_EMAIL` still works as a temporary single-account fallback, but `TRAVEL_PLAN_EMAILS` is preferred. These vars are not required for normal Travel Plan creation.
6. Generate a session secret and set `SESSION_SECRET`:
   ```sh
   openssl rand -hex 32
   ```
7. For Travel Plan invite emails, set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `SITE_URL` (for production, `https://sacor.xyz`). Invite emails are sent server-side from Netlify Functions.
8. Mirror the required vars into Netlify (Site settings &rarr; Environment variables) for production: `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SITE_URL`, and **`GOOGLE_PLACES_API_KEY`** (see Travel Plans place search below). Add `TRAVEL_PLAN_EMAILS` only if you want owner-account markers.
9. Redeploy the site after changing `VITE_GOOGLE_CLIENT_ID`; Vite bakes `VITE_` env vars into the frontend bundle at build time.

### Travel Plans place search

The itinerary **FIND A PLACE** control calls Google Places API (New) [Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search) via a Netlify proxy so no API keys are exposed in the browser.

1. Use the same (or linked) GCP project where you configured OAuth credentials, enable **[Places API (New)](https://console.cloud.google.com/apis/library/places.googleapis.com)** and ensure billing is active.
2. Create a **second API key used only by Netlify Functions** (do **not** reuse your OAuth/Web client secrets). Restrict it under **API restrictions** to **Places API (Under “Places APIs (New)” / Places API)**. Under **Application restrictions**, choose **None** — not “HTTP referrers”. Referrer-locked keys are for browser Maps/JS requests; server-side `fetch` to Places has **no Referer**, so Google returns `Requests from referer <empty> are blocked.`
3. Set `GOOGLE_PLACES_API_KEY` in `.env` for `netlify dev` and add it to Netlify environment variables, then redeploy.

**Endpoint:** `POST /.netlify/functions/geocode` with JSON `{ "q": "<search text>", "limit": 5 }` → `{ results: [{ id, name, lat, lng, type, address }] }`. (A `GET` with `?q=` is supported for debugging if the incoming URL includes query params.) Responses use `Cache-Control: no-store` so each query is fresh. Omitting the API key yields `503`; follow [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) for attribution shown in the editor.

### Endpoints

- `POST /.netlify/functions/auth-google` &mdash; verifies a Google ID token and sets the session cookie.
- `GET  /.netlify/functions/auth-me` &mdash; returns `{ user: { email, canAccessTravelPlans, canCreateTravelPlans, isOwner } | null, googleClientId }`. The `googleClientId` is echoed so the frontend can render the Google button without a separate config fetch.
- `POST /.netlify/functions/auth-logout` &mdash; clears the session cookie.
- `GET|POST|PUT|DELETE /.netlify/functions/travel-plans[?id=...&owner=...]` &mdash; CRUD for owned and shared travel plans. Owned plans live under the creator's user hash; shared access uses recipient indexes plus the canonical owner plan. Saves require a matching `version` and return `409` for stale edits.
- `GET|POST|DELETE /.netlify/functions/travel-plan-sharing?id=...` &mdash; owner-only share management. Adds/removes collaborator emails, stores saved contacts, and sends first-share invite emails through Resend.
- `POST /.netlify/functions/geocode` (`{ q, limit }`) &mdash; server-side Places Text Search proxy for Travel Plan stops (requires `GOOGLE_PLACES_API_KEY`). `GET` with `q` is accepted for manual checks.
