# "What's that song?" — song identification utility for sacor.xyz

## Context

Add a utility page to sacor.xyz: drop in a video/audio file, get told what song is playing. Music-heavy clips are often slowed/nightcore edits, so plain fingerprint lookup fails; the design includes a speed sweep. This plan is Phase 1 of the user's spec — it becomes `PLAN.md` in the repo (deliverable 1), then implementation follows.

## What the repo actually is (verified, not assumed)

- **Frontend**: React 19 SPA, Vite 8, plain JS/JSX (no tsconfig). Routes in `src/App.jsx`, utility grid in `src/data/downloadTools.js`.
- **Hosting**: **Netlify** (`netlify.toml`, publish `dist`, NODE_VERSION 20). **Not static-only** — ~32 serverless functions in `netlify/functions/*.mjs` (Web `Request`/`Response` API) are the real backend. No GitHub Actions; Netlify builds on git push.
- **ffmpeg.wasm is already in the stack**: `src/lib/mux.js` lazy-loads the single-threaded @ffmpeg/core 0.12.9 from unpkg (~30MB, no SharedArrayBuffer/COOP changes needed) for browser-side remuxing.
- **Rate-limit pattern exists**: `netlify/functions/geocode.mjs` — `bumpCounter()` on Netlify Blobs, minute+day keys, 429 on limit, plus in-memory dedup cache. `stumble-submissions.mjs` similar.
- **Error convention**: `{ code, message }` JSON envelope, shared across functions and the Express services.
- **Secrets**: server-only vars via `process.env` in functions (Netlify UI in prod), documented in `.env.example`. `VITE_`-prefixed vars are baked into the client bundle — the AudD token must never be `VITE_*`.
- `services/instagram-downloader` / `x-downloader` are legacy/local Express apps with **no committed production hosting** — not the model to follow here.

## Decisions (user-confirmed)

| Decision | Choice | Why |
|---|---|---|
| Extraction | **Client-side (ffmpeg.wasm)** | Netlify functions can't run a native ffmpeg binary (bundle limits, no committed alternative host); the site already ships the lazy ffmpeg.wasm pattern; full video never uploads (function body limit is ~6MB anyway); the ~30MB wasm cost is lazy-loaded and already accepted on other pages. |
| Provider | **AudD** | Token auth, 300 free lookups (no card), then ~$5/1,000 pay-as-you-go, no trial cliff; returns Spotify/Apple Music objects directly. ACRCloud's bigger DB doesn't outweigh 14-day-trial + HMAC for a personal site. AcoustID rejected (exact-recording matching, wrong tool). |
| Token location | `AUDD_API_TOKEN` env var, read only inside the Netlify function. Never `VITE_*`, never committed. Prod value set in Netlify UI. | |
| Cost ceiling | **$5/month**, enforced by a **global monthly API-call counter in Netlify Blobs** (`SONG_ID_MONTHLY_CALL_CAP`, default 1000 calls ≈ $5). When hit → 503 "temporarily unavailable" until month rolls over. | |
| Language | **TypeScript for all new files** (`.tsx`/`.ts`/`.mts`) — Vite and Netlify compile TS natively; existing JS files untouched. | |
| Branch | Develop and push on `claude/song-identification-utility-5sumwq` (CLAUDE.md's "work on main" is overridden for this remote session by user choice — pushing main would trigger prod deploys). | |

## Architecture

### Client (`src/pages/SongIdPage.tsx` + `src/lib/songid/`)

1. Drag-and-drop / file picker: `mp4 mov webm mp3 m4a wav ogg`, ≤50MB. Validate by **magic bytes** (ftyp/RIFF/ID3/0xFFEx/OggS/EBML), not extension/MIME.
2. ffmpeg.wasm decodes the audio track to mono 16-bit 44.1kHz PCM WAV: `-i in -vn -ac 1 -ar 44100 -f wav out.wav`. The existing `getFFmpeg()` loader is extracted from `src/lib/mux.js` into a shared `src/lib/ffmpeg.js` (mux.js refactored to import it — only refactor of existing code).
3. **Window selection**: sliding 12s window over the PCM, 1s hop, pick the window with highest sustained RMS (mean RMS with a floor-percentile guard so one loud transient doesn't win). Pure TS in `src/lib/songid/rms.ts`.
4. Slice those 12s of PCM and wrap in a WAV header (`src/lib/songid/wav.ts`) — no re-encode. ~1.06MB.
5. POST raw `audio/wav` body to `/.netlify/functions/song-identify`.
6. Progress states: `decoding → extracting clip → identifying`. Result card: title, artist, album, release date, cover art, Spotify/Apple links, confidence (nullable — see below), and when `matchedFactor ≠ 1.0`: "matched at 1.25× — this clip is slowed to about 0.8× speed". **No-match is a first-class result** with suggested next steps (try a section with clearer music, longer source, etc.), not an error toast.
7. Route `/song-id` in `App.jsx`; entry in `DOWNLOAD_TOOLS` grid ("WHAT'S THAT SONG").

### Server (`netlify/functions/song-identify.mts` + `_lib/songid/`)

Pipeline, in order:
1. **Kill switch**: `SONG_ID_DISABLED=true` → 503.
2. **Sign-in gate** (added after initial ship): `readSessionCookie` from `_lib/session.mjs` must yield a valid Google session, else 401 `auth_required`; the page shows a `GoogleSignInButton` to anonymous visitors.
3. Method/body checks; **magic-byte validation** that body is RIFF/WAVE, mono 16-bit PCM, and duration ≤12.5s (computed from header + byte length; hard body cap ~1.5MB). Unsupported → 415 `{ code, message }`, never a stack trace.
4. **Per-user rate limit**: 10/hour (`SONG_ID_RATE_LIMIT_PER_HOUR`), Netlify Blobs `bumpCounter` pattern copied from `geocode.mjs`, keyed by `userHash(email)` + hour bucket. Over → 429 with when-to-retry message. Blobs is the shared store — survives serverless invocations.
5. **Cache**: SHA-256 of clip bytes → Blobs lookup; hit returns the cached normalized result (match *and* no-match cached), so a retry costs zero API calls.
6. **Speed sweep** (`_lib/songid/sweep.ts`): factors `[1.0, 1.25, 1.15, 1.33, 1.10, 0.90, 0.80]`, capped at first `SONG_ID_MAX_SWEEP_ATTEMPTS` (default 4). Sequential, short-circuit on first match. Each attempt first bumps the global monthly counter (cap → stop sweeping, return 503 if no attempt succeeded).
   - **Resampling trick**: `asetrate` semantics (pitch+tempo shift together) are achieved by **rewriting only the WAV header's sample-rate field** to `round(44100 × factor)` — byte-identical samples, mathematically exactly what `asetrate` does; the provider resamples on ingest. Zero DSP, zero native deps in the function.
7. **Provider adapter** (`_lib/songid/audd.ts`): multipart POST to `api.audd.io` with `return=spotify,apple_music`, AbortController timeout (~8s/attempt within a total budget). `normalize.ts` maps AudD JSON → provider-agnostic shape; the frontend never sees AudD field names.
8. Response: `{ status: 'match'|'no_match', attemptsUsed, matchedFactor?, result?: { title, artist, album, releaseDate, coverArtUrl, spotifyUrl, appleMusicUrl, confidence } }`.
   - **Honesty note**: AudD's recognize endpoint returns no numeric confidence — for AudD, any result *is* a confident match, so `confidence` is `null` (UI omits the meter). The field exists in the schema so an ACRCloud adapter could fill it later.
9. **Privacy**: audio processed in memory only, never written or persisted; logs record counts/outcomes/factors only — never audio bytes or filenames.

### Env vars (added to `.env.example`, values in Netlify UI)

```
AUDD_API_TOKEN=            # server-only; NEVER VITE_-prefixed
SONG_ID_DISABLED=          # "true" = kill switch, endpoint returns 503
SONG_ID_MAX_SWEEP_ATTEMPTS=4
SONG_ID_MONTHLY_CALL_CAP=1000   # ≈ $5/mo after free tier
SONG_ID_RATE_LIMIT_PER_HOUR=10
```

## Tooling additions (flagged — new to this repo)

- `typescript` (dev) + minimal strict `tsconfig.json` (noEmit; editor/typecheck only — Vite/Netlify do their own transpile).
- `vitest` (dev) + `npm test` script — the idiomatic Vite-native test runner, runs TS directly; tests both client libs (RMS window, WAV build/parse, magic bytes) and server libs (sweep, normalization) in one runner. (Root repo currently has no test framework; services use `node --test`, which can't run TS.)

## Tests (deliverable 5)

- Fixtures: small **synthetic** WAVs (tone sweeps) generated by a checked-in script `scripts/make-songid-fixtures.mjs` and committed — no copyrighted audio in the repo.
- `sweep.test.ts`: mock provider that only "matches" at declared rate 55125Hz → asserts sweep tries factors in spec order, finds 1.25, short-circuits, respects the attempt cap and monthly-cap stop.
- `wav.test.ts`: header rewrite math, duration parsing, malformed-header rejection.
- `rms.test.ts`: synthetic quiet-then-loud PCM → picks the loud window, not t=0.
- `normalize.test.ts`: recorded AudD JSON fixtures (match, no-match, with/without spotify block) → normalized shape.
- Real-music acceptance (normal + slowed clip via `ffmpeg -af "asetrate=44100*0.8,aresample=44100"`) needs a real token + real song — documented as a manual smoke check the user runs locally with `netlify dev`.

## Verification

1. `npm test` (vitest suite above) and `npm run lint`.
2. `npm run build` then `grep -r "$AUDD_API_TOKEN\|AUDD" dist/` — token and var name absent from bundle (acceptance criterion).
3. Exercise the function handler directly in a test harness (construct `Request` objects): 429 after 10 hits from one IP; 415 with clean JSON for a PNG body; 503 when `SONG_ID_DISABLED=true`.
4. Manual end-to-end (user, locally with `netlify dev` + real token): normal-speed clip identifies; 0.8× slowed clip identifies with "matched at 1.25×" message.

## Files & commit sequence (small commits, one concern each)

1. `PLAN.md` (this plan, repo root).
2. `tsconfig.json` + `typescript`/`vitest` dev deps + `npm test` script.
3. `src/lib/ffmpeg.js` — extract shared loader; refactor `mux.js` to use it.
4. `src/lib/songid/` — `magicBytes.ts`, `wav.ts`, `rms.ts`, `extractClip.ts` (+ tests, fixtures script).
5. `netlify/functions/_lib/songid/` — `types.ts`, `wav.ts`, `sweep.ts`, `audd.ts`, `normalize.ts` (+ tests).
6. `netlify/functions/song-identify.mts` — handler wiring (kill switch, validation, rate limit, cache, sweep).
7. `src/pages/SongIdPage.tsx` + route + `DOWNLOAD_TOOLS` entry (styling follows existing downloader pages).
8. `.env.example` additions + README section (setup, env vars, cost: 1 lookup = 1–4 AudD calls; free tier 300 calls, then $0.005/call → ~0.5–2¢/lookup).

Along the way: flag unfamiliar React/TS idioms in chat (e.g. discriminated unions for progress state, `useRef` for the drop zone, generics in the normalizer) rather than using them silently.

## Non-goals (unchanged from spec)

No fingerprint database, no accounts/history, no non-music identification, no changes to existing pages beyond the mux.js loader extraction and the two registration touchpoints.
