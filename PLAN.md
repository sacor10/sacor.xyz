# Pay Index — a fixed-basket, unadjusted wage-change tracker for sacor.xyz

## Context

Build a **Pay Index**: the pay analog of the Chapwood Index. Same job titles,
same cities, same method, every period. It answers "what happened to actual
advertised pay for the same jobs in the same places" without any of the
machinery that makes official wage series feel laundered: no quality
adjustment, no substitution, no compositional reweighting, no seasonal
adjustment, and no government data anywhere in the pipeline. This plan is
Phase 1 of the user's spec — it becomes `PLAN.md` in the repo (deliverable 1),
then implementation follows.

The entire value of the thing is methodological discipline, so this plan
spends most of its effort on **enforcing the method in code** — DB triggers,
type shapes that make violations unrepresentable, and tests — rather than
documenting rules and hoping ingestion respects them. A number that quietly
degrades is worse than no number, so coverage stats publish next to every
headline figure and a dead source raises an alert instead of a silent gap.

## What the repo actually is (verified, not assumed)

- **Frontend**: React 19 SPA, Vite 8, TS-capable (`tsconfig.json` exists,
  `noEmit`, `strict`). Routes in `src/App.jsx`, nav in `src/Layout.jsx`
  (`NAV_GROUPS`). Closest precedent for this feature is `/psilocybin` — a
  data explorer with a methodology header, `sourceUrl` per record, `asOf`
  metadata, dependency-free chart primitives (`src/pages/psilocybin/charts.jsx`),
  and an "unlisted, intentionally not in nav" route comment.
- **Hosting**: **Netlify** (`netlify.toml`, publish `dist`, NODE_VERSION 20).
  Not static-only — ~34 serverless functions in `netlify/functions/*.mjs`/`.mts`
  (Web `Request`/`Response` API) are the real backend. No CI at all; Netlify
  builds on git push.
- **DB**: Turso/libSQL via `@libsql/client` (`netlify/functions/_lib/turso.mjs`,
  falls back to a local file DB when `TURSO_DATABASE_URL` is unset). No
  migrations directory — schema lives inline, memoized `ensureSchema(db)`
  plus a versioned seed table, exactly as in `netlify/functions/quotes.mjs`.
  **This is not Postgres and there is no host for a long-running Fastify
  server** — the spec's Fastify+Postgres stack doesn't fit this repo.
- **Error convention**: `{ code, message }` JSON envelope. Rate limiting via
  Netlify Blobs counters (`geocode.mjs`, `bumpCounter`).
- **Secrets**: server-only vars via `process.env` in functions (Netlify UI in
  prod), documented in `.env.example`. `VITE_`-prefixed vars are baked into
  the client bundle — never a secret.
- `services/instagram-downloader` / `x-downloader` are legacy/local Express
  apps with **no committed production hosting** — not the model to follow here.

## Decisions (user-confirmed)

| Decision | Choice | Why |
|---|---|---|
| Basket | ~60 jobs × ~25 metros ≈ 1,500 cells | Meets the 50–150 job floor; keeps free-tier API volume and gap counts sane. |
| Stack | **Netlify Functions + Turso/libSQL**, not Fastify + Postgres | The spec asked for Fastify+Postgres; this repo has neither and no host for a long-running server. `services/*` is the cautionary example. |
| Ingestion | **Committed Node CLI** (`scripts/pay-index-ingest.ts`), run monthly | ~1,500 cells × 3 source tiers blows past every Netlify function timeout. Resumable + checkpointed. |
| Tier C sources | **Exhaustive coverage attempt** | User's call, made after being warned these scrapers are brittle. Mitigated by design: a dead adapter produces a logged alert + explicit gap, never a wrong number. |
| Levels.fyi | Stored + displayed, **excluded from the headline** — and **unverified** | Its figures would be per-company medians — already averages — so `sources.kind='aggregate'` keeps the "never average an average" rule literally true regardless. Levels.fyi has no official public API; the `/companies/{slug}/salaries.md` endpoint this integration targets could not be confirmed to resolve from this project's environment. Manually verify before relying on it — see the README's Known Limitations. |
| First period | Baseline only, **no headline change figure** | Posting data cannot be backfilled. Period one publishes cells, coverage and the basket, and says plainly that the change figure arrives next period. |
| Chart library | Extend the dependency-free `psilocybin/charts.jsx` primitives, not Recharts | Matches the closest precedent, adds zero dependencies, keeps the retro visual language. |
| Nav | Unlisted at first | Route works; not in `NAV_GROUPS`, matching the `/psilocybin` precedent. |
| Language | **TypeScript for all new files** (`.ts`/`.tsx`/`.mts`) | Existing JS untouched. |
| Branch | `claude/pay-index-sacor-af7me5` (CLAUDE.md's "work on main" is overridden for this remote session — pushing main triggers a prod deploy). | |

## Architecture

Three pieces sharing one core:

```
scripts/pay-index-ingest.ts        →  writes immutable observations  ─┐
                                                                      ├→ Turso
netlify/functions/pay-index-*.mts  →  reads snapshots + cells        ─┘
src/pages/PayIndexPage.tsx         →  headline, chart, transparency table
```

`netlify/functions/_lib/payindex/` is the shared core, imported by both the
ingest CLI and the read functions, so schema and math exist in exactly one
place.

### File tree

```
src/data/payIndex/
  jobs.ts              # ~60 frozen job rows: title, category, canonicalKeywords[]
  cities.ts            # ~25 frozen metro rows: name, region, adzunaLocation
  basket.ts            # BASKET_VERSION, METHODOLOGY_VERSION, BASKET_FINGERPRINT
  changelog.ts         # dated basket_changelog entries
  sources.ts           # source registry: name, kind, licenseNote, attributionRequired
  atsBoards.ts         # Tier B: employer board tokens per ATS platform
  roleSources.ts       # Tier C: union locals, districts, carriers, nursing, Levels.fyi

netlify/functions/_lib/payindex/
  types.ts             # Observation, Cell, CellChange, IndexResult, AdapterRun
  errors.ts            # PayIndexError { code, message, status }
  schema.ts            # ensureSchema(db) — shared by CLI and read functions
  normalize.ts         # hourly → annual @2080; raw always retained
  aggregate.ts         # observations → cell_values, MIN_OBSERVATIONS = 5
  computeIndex.ts       # pure: (cells, baseline, current) => { mean, median, ... }
  fingerprint.ts        # canonical hash of the basket
  http.ts               # polite fetch: rate limit, retry, cache, robots.txt check
  adapters/
    index.ts            # registry + fetchObservations contract
    adzuna.ts                                # Tier A
    ats/{greenhouse,lever,ashby,workday}.ts  # Tier B — four extractors, not N
    roles/{levelsfyi,unionScale,districtSchedule,vivian,carrierPay}.ts  # Tier C

netlify/functions/
  pay-index-current.mts   pay-index-history.mts   pay-index-basket.mts
  pay-index-cells.mts     pay-index-coverage.mts

scripts/pay-index-ingest.ts         # monthly CLI, resumable
scripts/make-payindex-fixtures.mjs  # synthetic/recorded fixtures for tests

src/pages/PayIndexPage.tsx
src/pages/payindex/{charts.tsx,methodology.tsx,changelog.tsx,payindex.css}

tests/payindex/*.test.ts
```

Endpoint naming follows the `stumble-*` / `stocks-*` grain (many small
functions, not one router). `netlify.toml` gains redirects from the spec's
documented paths (`/api/index/current`, etc.) to the actual function paths,
placed **above** the existing SPA catch-all.

### Schema (SQLite/libSQL)

Adapted from the spec's model. SQLite has no array type, so
`canonical_keywords` is a JSON-text column. Additions beyond the spec, each
earning its place under "Enforcement" below: `sources.kind`,
`pay_observations.supersedes_observation_id`, `cell_values.status`, and an
`adapter_runs` table.

`ensureSchema(db)` uses the repo's memoized `let readyPromise = null` +
`CREATE TABLE IF NOT EXISTS` pattern from `quotes.mjs`, and a versioned seed
table (`pay_index_seed`) that plants `jobs`/`cities`/`sources` from
`src/data/payIndex/`.

### Adapter contract

```ts
type Adapter = {
  id: string
  tier: 'A' | 'B' | 'C'
  sourceId: string
  covers(job: Job, city: City): boolean
  fetchObservations(job: Job, city: City, period: Period): Promise<Observation[]>
}
```

All three tiers implement the same contract. `covers()` lets Tier C adapters
declare they only speak for, say, electricians in IBEW-local metros, without
every adapter being invoked for every cell.

## Enforcement — how each methodology rule is made real

| # | Rule | Enforced by |
|---|---|---|
| 1 | Fixed basket, versioned changes only | `fingerprint.ts` hashes the canonical sorted basket; a test asserts it equals the checked-in `BASKET_FINGERPRINT`. Editing a job/city fails the test until `BASKET_VERSION` is bumped and a dated `changelog.ts` entry is added. Ingest re-checks the fingerprint against the DB-recorded value for that version and aborts on mismatch. |
| 2 | No adjustment, ever | The schema has no adjusted columns. `normalize(raw, basis)` takes no period and no price-level argument — inflation adjustment is unrepresentable. A test asserts the signature is basis-conversion only and raw values survive alongside normalized ones. |
| 3 | Simple unweighted mean | `CellChange` has no weight field — nowhere to put one. `computeIndex` fixtures include a case where a population-weighted mean would give a different answer, so any regression toward weighting fails loudly. |
| 4 | No silent gaps | `cell_values.status ∈ ('included','gap_no_data','gap_below_threshold')` with a `CHECK` constraint that `status='included'` implies `observation_count >= 5`. Gaps are rows, not absences. `computeIndex` returns `missingCells[]`; a test asserts no path interpolates, carries forward, or substitutes a title. |
| 5 | Full traceability / immutability | SQLite triggers: `BEFORE UPDATE`/`BEFORE DELETE ON pay_observations` → `RAISE(ABORT, ...)`. Corrections insert a new row carrying `supersedes_observation_id`. Enforced by the database, not convention. |
| 6 | Publish basket + formula + coverage together | `/api/index/current`'s response type requires `methodologyVersion`, `basketVersion`, `formula`, `cellsIncluded`, `cellsMissing`. A test asserts the headline endpoint cannot omit them; the page renders coverage adjacent to the figure. |
| 7 | No averaging an average | `sources.kind ∈ ('posting','scale','aggregate')`. The `cell_values` aggregation query filters to `kind IN ('posting','scale')`. Levels.fyi (`kind='aggregate'`) is stored and displayed with attribution but excluded from the headline. |
| 8 | Zero rows is an alert | Every run writes an `adapter_runs` row (`adapter`, `period`, `rows_returned`, `status`, `error`). Zero rows for an adapter that ran → `status='alert'`, non-zero CLI exit code, red banner via `/api/coverage`. |
| 9 | No government data | A test asserts no configured `sourceUrl` host matches a government pattern (`.gov`, `.mil`, known BLS/Census/state-agency hosts). |

Source hygiene (`_lib/payindex/http.ts`): robots.txt honored per host,
per-host rate limiting with backoff, response caching keyed by URL hash, and
`source`/`source_url`/`fetched_at` recorded on every observation. Sources
requiring attribution render their notice wherever their figures appear
("Data source: Levels.fyi").

## Frontend

`/pay-index`, registered with one import + one `<Route>` in `src/App.jsx`.
Unlisted in nav initially. Sections: headline mean (median beside it),
coverage counts, trend chart, per-city breakdown, full transparency table of
every cell with source links and attribution, methodology and changelog
panels. New `.tsx` pages rely on the existing `src/types/retro-jsx.d.ts`
augmentation for `<font>`/`bgcolor`.

## Tooling additions (flagged — new to this repo)

- **`tsx`** (devDependency) + `"payindex:ingest"` script — the ingest CLI must
  be TypeScript and import the shared `_lib/payindex/*.ts` core, but plain
  `node` cannot import `.ts` directly. The alternative (duplicating the core
  in `.mjs`) breaks the single-source-of-truth guarantee rule 5 depends on.
- New env vars in `.env.example`: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`,
  `PAY_INDEX_MIN_OBSERVATIONS`, `PAY_INDEX_DISABLED`. Missing Adzuna
  credentials fail loudly at ingest time — never masquerade as a legitimate gap.

## Tests (`tests/payindex/`, vitest, TS, relative imports)

- `computeIndex.test.ts` — hand-computed fixtures; mean vs median; a
  weighting-would-differ case; gaps excluded and counted, never filled.
- `aggregate.test.ts` — the ≥5 threshold; median-of-midpoints;
  `kind='aggregate'` observations excluded from cells.
- `normalize.test.ts` — hourly ×2080; raw retained; signature admits no price input.
- `fingerprint.test.ts` — basket edit without a version bump + changelog fails.
- `immutability.test.ts` — UPDATE/DELETE on `pay_observations` abort (real
  local libSQL file DB).
- `adapters/*.test.ts` — recorded HTTP fixtures per platform, injected fetch
  implementation so no test touches the network.
- `sources.test.ts` — no government hosts; attribution flags present.
- `handler.test.ts` — endpoints exercised by constructing `Request` objects.

Fixtures are synthetic or recorded, generated by a committed
`scripts/make-payindex-fixtures.mjs`, following `make-songid-fixtures.mjs`.

## Verification

1. `npm test` and `npm run lint` and `npm run typecheck`.
2. `npm run build`, confirm no Adzuna credential or server-only value in `dist/`.
3. Run the ingest CLI against recorded fixtures; confirm `adapter_runs` rows
   and a non-zero exit when an adapter returns nothing.
4. Prove immutability by hand: `UPDATE pay_observations …` must abort.
5. `npx netlify dev` on `:8888`; hit each `/api/index/*` endpoint; load
   `/pay-index` and confirm the headline, coverage counts, gap rows, and
   per-source attribution all render together.

## Files & commit sequence (small commits, one concern each)

1. `PLAN.md` (this plan, repo root).
2. `src/data/payIndex/*` — basket config, fingerprint, changelog, sources (+ tests).
3. `netlify/functions/_lib/payindex/schema.ts` — schema, immutability triggers, seeding (+ tests).
4. `_lib/payindex/{normalize,aggregate,computeIndex}.ts` (+ hand-computed fixtures).
5. `_lib/payindex/{adapters/index.ts,http.ts}` — adapter contract + polite HTTP layer.
6. `_lib/payindex/adapters/adzuna.ts` — Tier A.
7. `_lib/payindex/adapters/ats/*.ts` — Tier B, four extractors + board config.
8. `_lib/payindex/adapters/roles/*.ts` — Tier C, one commit per role family.
9. `scripts/pay-index-ingest.ts` — resumable, checkpointed, alerting; `tsx` devDep.
10. `netlify/functions/pay-index-*.mts` + `netlify.toml` redirects.
11. `src/pages/PayIndexPage.tsx` + `src/pages/payindex/*` + route (unlisted).
12. `.env.example` additions + README section.

## Non-goals / honest limitations

- No fingerprint of "the" labor market — this is a fixed, small, unweighted
  basket by design, not a scientific sample.
- Tier C sources (union locals, district PDFs, carrier pay pages) will break
  and some may be broken on arrival; the methodology absorbs this as a logged
  alert + explicit gap, not a wrong number, but expect ongoing maintenance.
- Coverage will be uneven at launch — many of the ~1,500 cells will miss the
  ≥5-observation threshold in the first period. That's a visible gap by
  design, not a bug.
- The first published period is the baseline: no change figure until a
  second period is ingested.
- SQLite/libSQL, not Postgres. Table shapes stay portable.
- Ingestion is not automatic until a scheduler is wired to the CLI.
