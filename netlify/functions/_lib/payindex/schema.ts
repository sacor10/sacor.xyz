// Pay Index schema-on-boot: DDL, immutability triggers, and basket sync.
// Follows the netlify/functions/quotes.mjs convention (memoized
// ensureSchema + a versioned seed gate) but is hoisted into _lib because it
// has two independent callers — the read functions (via db.ts) and the
// ingest CLI (scripts/pay-index-ingest.ts) — and schema/seed logic must
// exist in exactly one place for both to stay in sync.
//
// libSQL's HTTP client executes one statement per db.execute() call and
// does not reliably honor `PRAGMA foreign_keys = ON` across requests, so
// methodology enforcement here leans on CHECK constraints and TRIGGERs
// (always enforced) rather than FOREIGN KEY constraints (best-effort/
// documentation only, but declared anyway for readability).

import type { Client } from '@libsql/client'
import { jobs } from '../../../../src/data/payIndex/jobs.ts'
import { cities } from '../../../../src/data/payIndex/cities.ts'
import { sources } from '../../../../src/data/payIndex/sources.ts'
import { changelog } from '../../../../src/data/payIndex/changelog.ts'
import { BASKET_VERSION, BASKET_FINGERPRINT } from '../../../../src/data/payIndex/basket.ts'
import { computeBasketFingerprint } from './fingerprint.ts'
import { BasketIntegrityError } from './errors.ts'

const SEED_VERSION = 'v1'

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS pay_index_jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    canonical_keywords TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(canonical_keywords)),
    negative_keywords TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(negative_keywords)),
    added_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    basket_version TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS pay_index_cities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    state_abbr TEXT NOT NULL DEFAULT '',
    added_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    basket_version TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS pay_index_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('posting','scale','aggregate')),
    tier TEXT NOT NULL CHECK (tier IN ('A','B','C')),
    license_note TEXT NOT NULL DEFAULT '',
    attribution_required INTEGER NOT NULL DEFAULT 0 CHECK (attribution_required IN (0,1)),
    attribution_text TEXT NOT NULL DEFAULT '',
    homepage_url TEXT NOT NULL DEFAULT '',
    CHECK (attribution_required = 0 OR length(attribution_text) > 0)
  )`,

  `CREATE TABLE IF NOT EXISTS pay_index_basket_versions (
    version TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,

  `CREATE TABLE IF NOT EXISTS pay_index_basket_changelog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    effective_date TEXT NOT NULL,
    basket_version TEXT NOT NULL,
    methodology_version TEXT NOT NULL,
    change_type TEXT NOT NULL,
    detail TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (basket_version, change_type, detail)
  )`,

  // Immutable raw ledger. Rule 5/6: every published number traces back to a
  // row here, and rows here are never mutated or removed — corrections are
  // new rows via superseded_by.
  `CREATE TABLE IF NOT EXISTS pay_index_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL REFERENCES pay_index_jobs(id),
    city_id TEXT NOT NULL REFERENCES pay_index_cities(id),
    source_id TEXT NOT NULL REFERENCES pay_index_sources(id),
    period TEXT NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
    raw_min REAL,
    raw_max REAL,
    raw_point REAL,
    pay_basis TEXT NOT NULL CHECK (pay_basis IN ('hourly','annual')),
    annual_point REAL NOT NULL CHECK (annual_point > 0),
    source_url TEXT NOT NULL CHECK (source_url LIKE 'http%'),
    fetched_at TEXT NOT NULL,
    sample_size INTEGER,
    observation_key TEXT NOT NULL UNIQUE,
    transcribed INTEGER NOT NULL DEFAULT 0 CHECK (transcribed IN (0,1)),
    superseded_by INTEGER REFERENCES pay_index_observations(id),
    void_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (raw_point IS NOT NULL OR (raw_min IS NOT NULL AND raw_max IS NOT NULL)),
    CHECK (raw_min IS NULL OR raw_max IS NULL OR raw_max >= raw_min)
  )`,

  `CREATE INDEX IF NOT EXISTS pay_index_obs_cell ON pay_index_observations(period, job_id, city_id)`,
  `CREATE INDEX IF NOT EXISTS pay_index_obs_source ON pay_index_observations(period, source_id)`,

  // Immutability, enforced by the database itself (rule 5/6). Note this
  // deliberately does NOT block updates to superseded_by/void_reason —
  // those are the correction mechanism, not a mutation of raw data.
  `CREATE TRIGGER IF NOT EXISTS pay_index_observations_no_update
   BEFORE UPDATE OF job_id, city_id, source_id, period, raw_min, raw_max, raw_point,
     pay_basis, annual_point, source_url, fetched_at, sample_size, observation_key
   ON pay_index_observations
   BEGIN
     SELECT RAISE(ABORT, 'pay_index_observations is append-only: insert a correction row and set superseded_by');
   END`,

  `CREATE TRIGGER IF NOT EXISTS pay_index_observations_no_delete
   BEFORE DELETE ON pay_index_observations
   BEGIN
     SELECT RAISE(ABORT, 'pay_index_observations is append-only: void via void_reason, never DELETE');
   END`,

  // Derived cells. The observation_count CHECK is rule 4 as a constraint:
  // a below-threshold cell cannot physically be written as 'included'.
  `CREATE TABLE IF NOT EXISTS pay_index_cell_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    city_id TEXT NOT NULL,
    period TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('included','gap_no_data','gap_below_threshold')),
    median_annual_pay REAL,
    observation_count INTEGER NOT NULL DEFAULT 0,
    source_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(source_ids)),
    observation_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(observation_ids)),
    computed_at TEXT NOT NULL,
    methodology_version TEXT NOT NULL,
    UNIQUE (job_id, city_id, period),
    CHECK (status <> 'included' OR (median_annual_pay IS NOT NULL AND observation_count >= 5)),
    CHECK (status = 'included' OR median_annual_pay IS NULL)
  )`,

  `CREATE INDEX IF NOT EXISTS pay_index_cell_period ON pay_index_cell_values(period)`,

  // Published snapshots. cells_included + cells_missing = cells_total is
  // rule 4, arithmetically: a cell can never just disappear from the count.
  `CREATE TABLE IF NOT EXISTS pay_index_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT NOT NULL,
    baseline_period TEXT NOT NULL,
    index_mean REAL NOT NULL,
    index_median REAL NOT NULL,
    cells_included INTEGER NOT NULL CHECK (cells_included >= 0),
    cells_missing INTEGER NOT NULL CHECK (cells_missing >= 0),
    cells_total INTEGER NOT NULL,
    basket_version TEXT NOT NULL,
    methodology_version TEXT NOT NULL,
    computed_at TEXT NOT NULL,
    CHECK (cells_included + cells_missing = cells_total),
    UNIQUE (period, baseline_period, basket_version, methodology_version)
  )`,

  `CREATE TABLE IF NOT EXISTS pay_index_city_breakdown (
    period TEXT NOT NULL,
    baseline_period TEXT NOT NULL,
    city_id TEXT NOT NULL,
    mean REAL NOT NULL,
    median REAL NOT NULL,
    cells_included INTEGER NOT NULL,
    cells_missing INTEGER NOT NULL,
    PRIMARY KEY (period, baseline_period, city_id)
  )`,

  // Ingest run ledger: resume checkpoint AND the zero-rows alert log (rule 8).
  `CREATE TABLE IF NOT EXISTS pay_index_adapter_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    adapter_id TEXT NOT NULL,
    job_id TEXT,
    city_id TEXT,
    period TEXT NOT NULL,
    rows_returned INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('ok','zero_rows','error')),
    error TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT
  )`,

  `CREATE INDEX IF NOT EXISTS pay_index_adapter_runs_run ON pay_index_adapter_runs(run_id)`,
  `CREATE INDEX IF NOT EXISTS pay_index_adapter_runs_adapter ON pay_index_adapter_runs(adapter_id, period)`,

  `CREATE TABLE IF NOT EXISTS pay_index_seed (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
]

function nowIso(): string {
  return new Date().toISOString()
}

// The basket is config, not user data: src/data/payIndex is the source of
// truth on every boot, so jobs/cities/sources are kept in sync via
// INSERT OR REPLACE (idempotent, ~90 rows, cheap) rather than a one-time
// seed gate. The one-time gate below applies only to the changelog, since
// changelog history should never be "replaced".
async function syncBasketTables(db: Client): Promise<void> {
  for (const job of jobs) {
    await db.execute({
      sql: `INSERT INTO pay_index_jobs (id, title, category, canonical_keywords, negative_keywords, added_at, active, basket_version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET title=excluded.title, category=excluded.category,
              canonical_keywords=excluded.canonical_keywords, negative_keywords=excluded.negative_keywords,
              active=excluded.active, basket_version=excluded.basket_version`,
      args: [
        job.id,
        job.title,
        job.category,
        JSON.stringify(job.canonicalKeywords),
        JSON.stringify(job.negativeKeywords),
        job.addedAt,
        job.active ? 1 : 0,
        job.basketVersion,
      ],
    })
  }

  for (const city of cities) {
    await db.execute({
      sql: `INSERT INTO pay_index_cities (id, name, region, state_abbr, added_at, active, basket_version)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name, region=excluded.region,
              state_abbr=excluded.state_abbr, active=excluded.active, basket_version=excluded.basket_version`,
      args: [city.id, city.name, city.region, city.stateAbbr, city.addedAt, city.active ? 1 : 0, city.basketVersion],
    })
  }

  for (const source of sources) {
    await db.execute({
      sql: `INSERT INTO pay_index_sources (id, name, kind, tier, license_note, attribution_required, attribution_text, homepage_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name, kind=excluded.kind, tier=excluded.tier,
              license_note=excluded.license_note, attribution_required=excluded.attribution_required,
              attribution_text=excluded.attribution_text, homepage_url=excluded.homepage_url`,
      args: [
        source.id,
        source.name,
        source.kind,
        source.tier,
        source.licenseNote,
        source.attributionRequired ? 1 : 0,
        source.attributionText,
        source.homepageUrl,
      ],
    })
  }

  for (const entry of changelog) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO pay_index_basket_changelog
              (effective_date, basket_version, methodology_version, change_type, detail)
            VALUES (?, ?, ?, ?, ?)`,
      args: [entry.effectiveDate, entry.basketVersion, entry.methodologyVersion, entry.changeType, entry.detail],
    })
  }
}

// Methodology rule 1, enforced at boot: the basket may only change via a
// version bump. If BASKET_VERSION was already recorded with a DIFFERENT
// content hash than what jobs.ts/cities.ts produce right now, the basket
// was edited without following the protocol — refuse to boot rather than
// silently serve numbers computed from a basket nobody versioned.
async function assertBasketIntegrity(db: Client): Promise<void> {
  const liveFingerprint = computeBasketFingerprint(jobs, cities)
  if (liveFingerprint !== BASKET_FINGERPRINT) {
    throw new BasketIntegrityError(
      `Basket content does not match the checked-in BASKET_FINGERPRINT for version ${BASKET_VERSION}. ` +
        'The basket was edited without following the required protocol: bump BASKET_VERSION, add a ' +
        'changelog.ts entry, then regenerate BASKET_FINGERPRINT (see basket.ts header comment).',
    )
  }

  const recorded = await db.execute({
    sql: 'SELECT content_hash FROM pay_index_basket_versions WHERE version = ?',
    args: [BASKET_VERSION],
  })

  if (recorded.rows.length === 0) {
    await db.execute({
      sql: 'INSERT INTO pay_index_basket_versions (version, content_hash, applied_at) VALUES (?, ?, ?)',
      args: [BASKET_VERSION, liveFingerprint, nowIso()],
    })
    return
  }

  const recordedHash = String(recorded.rows[0].content_hash)
  if (recordedHash !== liveFingerprint) {
    throw new BasketIntegrityError(
      `Basket version ${BASKET_VERSION} was previously recorded with a different fingerprint ` +
        `(${recordedHash} vs live ${liveFingerprint}). A basket version must never be reused for ` +
        'different content — bump BASKET_VERSION for this change instead.',
    )
  }
}

export async function ensureSchema(db: Client): Promise<void> {
  for (const statement of DDL_STATEMENTS) {
    await db.execute(statement)
  }

  await assertBasketIntegrity(db)

  const seeded = await db.execute({
    sql: 'SELECT version FROM pay_index_seed WHERE version = ?',
    args: [SEED_VERSION],
  })

  await syncBasketTables(db)

  if (seeded.rows.length === 0) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO pay_index_seed (version) VALUES (?)',
      args: [SEED_VERSION],
    })
  }
}
