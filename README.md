# sacor.xyz

Personal homepage with a loud late-90s/GeoCities aesthetic. Built with React 19 + Vite, deployed on Netlify, with a handful of serverless functions backing the dynamic bits.

## Pages

Most pages are static React (home, blog index/post, contact, guestbook, MTS, webring, YtMp4). A few pages need backend setup to work end-to-end:

- `/stocks` — candlestick chart + live price ticker (see below).
- `/travel-plans` — private and shared markdown itinerary CRUD (see below).

- `/stumble` - StumbleUpon-style web discovery backed by a curated and moderated corpus (see below).
- `/instagram-downloader` - public Instagram Reel/post downloader backed by a separate Node API (see below).
- `/x-downloader` - public X/Twitter post video downloader backed by a separate Node API (see below).
- `/facebook-downloader` - public Facebook reel/watch/video downloader backed by the `facebook-download` Netlify Function (resolves share & fb.watch links, streams the MP4 via the `facebook-video` proxy).

## Scripts

- `npm run dev` — Vite dev server (no Netlify Functions; `/stocks` and `/travel-plans` won't work).
- `npx netlify dev` — Vite + Functions on `http://localhost:8888`.
- `npm run build` / `npm run preview` / `npm run lint`.

- `npm run stumble:validate` - validate the `/stumble` corpus for duplicates, domain caps, metadata, interest coverage, and URL hygiene.
- `npm run stumble:report` - print `/stumble` corpus distribution by domain, topic, content type, frame policy, and status.

- `npm --prefix services/instagram-downloader run dev` - local Instagram downloader API on `http://localhost:8787`.
- `npm --prefix services/x-downloader run dev` - local X/Twitter downloader API on `http://localhost:8788`.

## Stumble (`/stumble`)

`/stumble` is a StumbleUpon-style discovery loop. Guests can stumble with local seen exclusion; signed-in users get server-side seen/rated exclusion, saved interests, and thumbs feedback.

The approved pool is stored in Netlify Blobs (`stumble-pages`) and lazily seeded from [`src/data/stumblePages.js`](src/data/stumblePages.js). The seed corpus is curated, English-first, safe-for-work, and tagged with interests, content type, frame policy, source, quality score, and safety metadata. Existing Blob records are migrated lazily when the seed version changes so votes and user state are preserved.

### Corpus maintenance

1. Add or edit curated seeds in `src/data/stumblePages.js`.
2. Keep domains under the soft cap of 4 pages unless there is a deliberate reason to expand a source.
3. Run:
   ```sh
   npm run stumble:validate
   npm run stumble:report
   ```
4. Run `npx netlify dev` and visit `http://localhost:8888/stumble` to exercise the function-backed route.

### Submissions and moderation

- `POST /.netlify/functions/stumble-submissions` accepts public site submissions, canonicalizes/dedupes the URL, fetches bounded preview metadata, rate-limits submitters, and stores the page as `pending`.
- `GET /.netlify/functions/stumble-moderation?status=pending` lists pending submissions for owner accounts only.
- `POST /.netlify/functions/stumble-moderation` with `{ "id": "...", "action": "approve" }` approves a pending page into the live pool. `{ "action": "reject" }` moves it to the rejected index.
- Owner access uses the existing Google session owner check (`TRAVEL_PLAN_EMAILS` / `OWNER_EMAIL`).

The recommender preserves seen/rated exclusion, relaxes interest filters when they would starve the user, and uses a weighted random pick with recent domain/content-type penalties so the feed stays broad instead of clustering around one site. Signed-in users also get a social nudge: pages liked by people they follow score a small bonus.

### Profiles and following

Signed-in users can claim a public `@username` (immutable in v1) and get a profile page at `/stumble/u/:username`.

- `GET /.netlify/functions/stumble-profile?username=foo` — public profile (follower/following counts + handles). A signed-in viewer also gets the profile's liked pages and `isFollowing`/`isSelf` flags; guests get `signInRequired` and no likes.
- `GET /.netlify/functions/stumble-profile` (no param) — the signed-in caller's own handle + counts, so the UI knows whether to prompt a username claim.
- `PUT /.netlify/functions/stumble-profile` with `{ "username": "..." }` — claim a handle (`409` if taken/already set, `400` if invalid).
- `POST /.netlify/functions/stumble-follow` with `{ "username": "...", "action": "follow" | "unfollow" }` — mutate the follow graph (both sides updated; deduped).
- `GET /.netlify/functions/stumble-feed` — recent likes from the people you follow, newest first, each tagged with who liked it.
- `GET /.netlify/functions/stumble?from=<username>` — "stumble their likes" mode: restrict the pool to one person's liked pages (signed-in only).

The social graph and handles live in the existing `stumble-users` Blob store (`users/{hash}/profile`, `users/{hash}/following`, `users/{hash}/followers`, and a `usernames/{handle}` → hash index). Likes carry a timestamp (`{ id, at }`, migrated lazily from the legacy id-only form) so the feed can sort by recency. Blobs has no transactions, so username claims and follow writes are best-effort and idempotent.

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

The `/x-downloader` page is served entirely by Netlify: the React page calls `/.netlify/functions/x-download`, which resolves the post via X's public syndication endpoint and returns JSON metadata. The browser then fetches each MP4 directly from `videos.twimg.com` and (for multi-video posts) zips them client-side with [JSZip](https://stuk.github.io/jszip/).

This sidesteps the Lambda 6 MB response cap and the function timeout — bytes never pass through the function.

### Running locally

1. `npx netlify dev` from the repo root.
2. Visit `http://localhost:8888/x-downloader`.

No service or env var setup is required.

### Endpoint

- `POST /.netlify/functions/x-download` with JSON `{ "url": "https://x.com/user/status/123..." }` — returns `{ "videos": [{ "url", "filename", "width", "height" }] }` for public posts. Image-only, private, login-required, or invalid URLs return `{ code, message }` with an appropriate status.

### Known limits

- The syndication endpoint covers normal public posts and reposts. Protected accounts, Communities-only posts, age-restricted media, Spaces, and some live videos won't resolve and surface as `no_videos` (404).
- The undocumented syndication `token` algorithm has been stable for years but could break without notice — treat extractor breakage as a maintenance risk.
- The browser ZIP path requires `videos.twimg.com` to permit cross-origin GETs (currently does). Single-video downloads also fetch the blob in the browser; if Twitter ever locks CORS, the page will need a fallback.

### Legacy local Express service

`services/x-downloader/` still contains the original yt-dlp-backed Express service, with its own `npm --prefix services/x-downloader run dev` script. It's not used by the deployed site and is kept around for local experimentation only.

## YouTube Downloader

The in-browser YouTube downloader was removed. Running yt-dlp from Netlify Functions (AWS Lambda datacenter IPs) triggered YouTube's "Sign in to confirm you're not a bot" challenge, which can't be reliably worked around server-side without a residential proxy or account cookies. The `/youtube-downloader` route now redirects to `/ytmp4`, the downloadable Windows EXE that runs yt-dlp locally from the user's own (residential) IP.

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
4. **Cap worst-case spend in Google Cloud (strongly recommended).** Because the key uses **None** application restrictions (see step 2 — server-side `fetch` sends no Referer, and Netlify egress IPs are dynamic so IP locking is impractical), bound the bill at the platform level: set a **daily request quota cap** on *Places API (New)* under **APIs &amp; Services → Quotas**, and add a **Cloud Billing budget + alert**. These backstop the app-layer controls if anything regresses.

**Abuse controls.** Places is billed per request, so the `geocode` proxy is hardened against being scripted into a runaway bill:

- **Requires a signed-in session** — the endpoint calls `requireTravelAccess`, so anonymous requests get `401` (`{ error: "Sign in to search places." }`). The session cookie is sent automatically because the editor calls the same-origin function. This is the primary defense; the only legitimate caller is the login-gated Travel Plans editor.
- **Per-user rate limit** — daily (`DAILY_LIMIT`) and short burst (`PER_MINUTE_LIMIT`) caps are tracked per user in Netlify Blobs (store `geocode`); exceeding them yields `429`.
- **Short-TTL dedup cache** — identical recent queries are served from memory (`CACHE_TTL_MS`) without re-billing Google.

**Endpoint:** `POST /.netlify/functions/geocode` with JSON `{ "q": "<search text>", "limit": 5 }` → `{ results: [{ id, name, lat, lng, type, address }] }`. (A `GET` with `?q=` is supported for debugging if the incoming URL includes query params.) Requires a valid session cookie. Responses use `Cache-Control: no-store` so each query is fresh. Omitting the API key yields `503`; follow [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) for attribution shown in the editor.

### Endpoints

- `POST /.netlify/functions/auth-google` &mdash; verifies a Google ID token and sets the session cookie.
- `GET  /.netlify/functions/auth-me` &mdash; returns `{ user: { email, canAccessTravelPlans, canCreateTravelPlans, isOwner } | null, googleClientId }`. The `googleClientId` is echoed so the frontend can render the Google button without a separate config fetch.
- `POST /.netlify/functions/auth-logout` &mdash; clears the session cookie.
- `GET|POST|PUT|DELETE /.netlify/functions/travel-plans[?id=...&owner=...]` &mdash; CRUD for owned and shared travel plans. Owned plans live under the creator's user hash; shared access uses recipient indexes plus the canonical owner plan. Saves require a matching `version` and return `409` for stale edits.
- `GET|POST|DELETE /.netlify/functions/travel-plan-sharing?id=...` &mdash; owner-only share management. Adds/removes collaborator emails, stores saved contacts, and sends first-share invite emails through Resend.
- `POST /.netlify/functions/geocode` (`{ q, limit }`) &mdash; server-side Places Text Search proxy for Travel Plan stops (requires `GOOGLE_PLACES_API_KEY` and a signed-in session; per-user rate-limited). `GET` with `q` is accepted for manual checks.
