// The persistence layer: every place raw Observations become DB rows, and
// every place stored rows become the pure aggregate.ts/computeIndex.ts
// inputs. Keeping all SQL here (rather than scattered through the ingest
// CLI and read functions) is what keeps normalize/aggregate/computeIndex
// pure and testable without a database.

import type { Client } from '@libsql/client'
import { jobs as basketJobs } from '../../../../src/data/payIndex/jobs.ts'
import { cities as basketCities } from '../../../../src/data/payIndex/cities.ts'
import { METHODOLOGY_VERSION, BASKET_VERSION } from '../../../../src/data/payIndex/basket.ts'
import { normalizeToAnnual } from './normalize.ts'
import { buildCellValue } from './aggregate.ts'
import { computeIndex, cellKey, type BasketCellRef } from './computeIndex.ts'
import type { Observation, NormalizedObservation, CellValue, AdapterRunStatus, IndexResult } from './types.ts'

function nowIso(): string {
  return new Date().toISOString()
}

// Inserts one observation, normalizing it to the common annual basis on the
// way in. Uses INSERT OR IGNORE keyed on the UNIQUE observation_key, so a
// resumed/retried ingest run can safely re-submit the same observation
// without double-counting it (methodology rule 7's dedupe guarantee).
// Returns true if a new row was actually written, false if it was already
// present.
export async function insertObservation(db: Client, obs: Observation): Promise<boolean> {
  const { annualPoint } = normalizeToAnnual({
    rawMin: obs.rawMin,
    rawMax: obs.rawMax,
    rawPoint: obs.rawPoint,
    payBasis: obs.payBasis,
  })

  const result = await db.execute({
    sql: `INSERT OR IGNORE INTO pay_index_observations
            (job_id, city_id, source_id, period, raw_min, raw_max, raw_point, pay_basis,
             annual_point, source_url, fetched_at, sample_size, observation_key, transcribed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      obs.jobId,
      obs.cityId,
      obs.sourceId,
      obs.period,
      obs.rawMin,
      obs.rawMax,
      obs.rawPoint,
      obs.payBasis,
      annualPoint,
      obs.sourceUrl,
      obs.fetchedAt,
      obs.sampleSize,
      obs.observationKey,
      obs.transcribed ? 1 : 0,
    ],
  })

  return result.rowsAffected > 0
}

export async function insertObservations(db: Client, observations: readonly Observation[]): Promise<{ inserted: number }> {
  let inserted = 0
  for (const obs of observations) {
    if (await insertObservation(db, obs)) inserted++
  }
  return { inserted }
}

interface ObservationRow {
  readonly id: number
  readonly source_id: string
  readonly kind: string
  readonly job_id: string
  readonly city_id: string
  readonly period: string
  readonly raw_min: number | null
  readonly raw_max: number | null
  readonly raw_point: number | null
  readonly pay_basis: string
  readonly annual_point: number
  readonly source_url: string
  readonly fetched_at: string
  readonly sample_size: number | null
  readonly observation_key: string
}

// Loads every live (not superseded, not voided) observation for one cell,
// joined against pay_index_sources to recover each source's kind —
// aggregate.ts needs that to exclude 'aggregate'-kind sources from the
// median (rule 7).
async function loadCellObservations(db: Client, jobId: string, cityId: string, period: string): Promise<NormalizedObservation[]> {
  const result = await db.execute({
    sql: `SELECT o.id, o.source_id, s.kind, o.job_id, o.city_id, o.period,
                 o.raw_min, o.raw_max, o.raw_point, o.pay_basis, o.annual_point,
                 o.source_url, o.fetched_at, o.sample_size, o.observation_key
          FROM pay_index_observations o
          JOIN pay_index_sources s ON s.id = o.source_id
          WHERE o.job_id = ? AND o.city_id = ? AND o.period = ?
            AND o.superseded_by IS NULL AND o.void_reason IS NULL`,
    args: [jobId, cityId, period],
  })

  return (result.rows as unknown as ObservationRow[]).map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    sourceKind: row.kind as NormalizedObservation['sourceKind'],
    jobId: row.job_id,
    cityId: row.city_id,
    period: row.period,
    rawMin: row.raw_min,
    rawMax: row.raw_max,
    rawPoint: row.raw_point,
    payBasis: row.pay_basis as NormalizedObservation['payBasis'],
    annualPoint: row.annual_point,
    sourceUrl: row.source_url,
    fetchedAt: row.fetched_at,
    sampleSize: row.sample_size,
    observationKey: row.observation_key,
  }))
}

// Aggregates stored observations for one (job, city, period) cell and
// writes the result — either an included cell or a gap row — to
// pay_index_cell_values. This table is derived/recomputable (unlike
// pay_index_observations), so it's fine to overwrite on a recompute.
export async function computeAndStoreCellValue(db: Client, jobId: string, cityId: string, period: string): Promise<CellValue> {
  const observations = await loadCellObservations(db, jobId, cityId, period)
  const outcome = buildCellValue({ jobId, cityId, period, observations })
  const computedAt = nowIso()

  if (outcome.kind === 'gap') {
    await db.execute({
      sql: `INSERT INTO pay_index_cell_values
              (job_id, city_id, period, status, median_annual_pay, observation_count, source_ids, observation_ids, computed_at, methodology_version)
            VALUES (?, ?, ?, ?, NULL, ?, '[]', '[]', ?, ?)
            ON CONFLICT(job_id, city_id, period) DO UPDATE SET
              status=excluded.status, median_annual_pay=excluded.median_annual_pay,
              observation_count=excluded.observation_count, source_ids=excluded.source_ids,
              observation_ids=excluded.observation_ids, computed_at=excluded.computed_at,
              methodology_version=excluded.methodology_version`,
      args: [jobId, cityId, period, outcome.reason, outcome.observationCount, computedAt, METHODOLOGY_VERSION],
    })
    return { jobId, cityId, period, status: outcome.reason, medianAnnualPay: null, observationCount: outcome.observationCount, sourceIds: [] }
  }

  const observationIds = observations.filter((o) => o.sourceKind !== 'aggregate').map((o) => o.id)
  await db.execute({
    sql: `INSERT INTO pay_index_cell_values
            (job_id, city_id, period, status, median_annual_pay, observation_count, source_ids, observation_ids, computed_at, methodology_version)
          VALUES (?, ?, ?, 'included', ?, ?, ?, ?, ?, ?)
          ON CONFLICT(job_id, city_id, period) DO UPDATE SET
            status=excluded.status, median_annual_pay=excluded.median_annual_pay,
            observation_count=excluded.observation_count, source_ids=excluded.source_ids,
            observation_ids=excluded.observation_ids, computed_at=excluded.computed_at,
            methodology_version=excluded.methodology_version`,
    args: [
      jobId,
      cityId,
      period,
      outcome.value.medianAnnualPay,
      outcome.value.observationCount,
      JSON.stringify(outcome.value.sourceIds),
      JSON.stringify(observationIds),
      computedAt,
      METHODOLOGY_VERSION,
    ],
  })
  return outcome.value
}

interface CellValueRow {
  readonly job_id: string
  readonly city_id: string
  readonly period: string
  readonly status: string
  readonly median_annual_pay: number | null
  readonly observation_count: number
  readonly source_ids: string
}

async function loadCellValues(db: Client, period: string): Promise<Map<string, CellValue>> {
  const result = await db.execute({ sql: 'SELECT * FROM pay_index_cell_values WHERE period = ?', args: [period] })
  const map = new Map<string, CellValue>()
  for (const row of result.rows as unknown as CellValueRow[]) {
    map.set(cellKey(row.job_id, row.city_id), {
      jobId: row.job_id,
      cityId: row.city_id,
      period: row.period,
      status: row.status as CellValue['status'],
      medianAnnualPay: row.median_annual_pay,
      observationCount: row.observation_count,
      sourceIds: JSON.parse(row.source_ids) as string[],
    })
  }
  return map
}

export async function getBaselinePeriod(db: Client): Promise<string | null> {
  const result = await db.execute('SELECT period FROM pay_index_baseline WHERE id = 1')
  return result.rows.length > 0 ? String(result.rows[0].period) : null
}

// The baseline is set exactly once, by whichever period is ingested first.
// A no-op if a baseline already exists — this is a fixed-basket index
// measured against ONE baseline (Chapwood-style), not a rolling prior
// period, so this must never silently move.
export async function setBaselinePeriodIfUnset(db: Client, period: string): Promise<void> {
  await db.execute({
    sql: 'INSERT OR IGNORE INTO pay_index_baseline (id, period, set_at) VALUES (1, ?, ?)',
    args: [period, nowIso()],
  })
}

function activeBasketCells(): BasketCellRef[] {
  const cells: BasketCellRef[] = []
  for (const job of basketJobs.filter((j) => j.active)) {
    for (const city of basketCities.filter((c) => c.active)) {
      cells.push({ jobId: job.id, cityId: city.id })
    }
  }
  return cells
}

// Computes the full index for `period` against the recorded baseline and
// writes the published snapshot + per-city breakdown. Returns null in two
// cases where there is deliberately no headline change figure to publish:
//   - no baseline is set yet at all
//   - `period` IS the baseline period itself (comparing it to itself would
//     produce a trivial 0%-everywhere snapshot that looks like a real "no
//     change" measurement rather than "nothing to compare against yet" —
//     the plan is explicit that the first period publishes coverage and
//     cell values with no change figure, never a fake 0.00%).
export async function computeAndStoreSnapshot(db: Client, period: string): Promise<IndexResult | null> {
  const baselinePeriod = await getBaselinePeriod(db)
  if (baselinePeriod === null || baselinePeriod === period) return null

  const basketCells = activeBasketCells()
  const currentCells = await loadCellValues(db, period)
  const baselineCells = await loadCellValues(db, baselinePeriod)

  const result = computeIndex({ period, baselinePeriod, basketCells, currentCells, baselineCells })
  const computedAt = nowIso()

  await db.execute({
    sql: `INSERT INTO pay_index_snapshots
            (period, baseline_period, index_mean, index_median, cells_included, cells_missing, cells_total,
             basket_version, methodology_version, computed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(period, baseline_period, basket_version, methodology_version) DO UPDATE SET
            index_mean=excluded.index_mean, index_median=excluded.index_median,
            cells_included=excluded.cells_included, cells_missing=excluded.cells_missing,
            cells_total=excluded.cells_total, computed_at=excluded.computed_at`,
    args: [
      period,
      baselinePeriod,
      result.mean,
      result.median,
      result.cellsIncluded,
      result.cellsMissing,
      result.cellsTotal,
      BASKET_VERSION,
      METHODOLOGY_VERSION,
      computedAt,
    ],
  })

  const byCity = new Map<string, { sum: number; changes: number[]; missing: number }>()
  for (const city of basketCities.filter((c) => c.active)) byCity.set(city.id, { sum: 0, changes: [], missing: 0 })
  for (const change of result.changes) {
    const bucket = byCity.get(change.cityId)
    if (bucket) bucket.changes.push(change.pctChange)
  }
  for (const missing of result.missingCells) {
    const bucket = byCity.get(missing.cityId)
    if (bucket) bucket.missing++
  }

  for (const [cityId, bucket] of byCity) {
    const included = bucket.changes.length
    const mean = included === 0 ? 0 : bucket.changes.reduce((a, b) => a + b, 0) / included
    const sorted = [...bucket.changes].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const median = sorted.length === 0 ? 0 : sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]

    await db.execute({
      sql: `INSERT INTO pay_index_city_breakdown (period, baseline_period, city_id, mean, median, cells_included, cells_missing)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(period, baseline_period, city_id) DO UPDATE SET
              mean=excluded.mean, median=excluded.median,
              cells_included=excluded.cells_included, cells_missing=excluded.cells_missing`,
      args: [period, baselinePeriod, cityId, mean, median, included, bucket.missing],
    })
  }

  return result
}

export interface AdapterRunRecord {
  readonly runId: string
  readonly adapterId: string
  readonly jobId: string | null
  readonly cityId: string | null
  readonly period: string
  readonly rowsReturned: number
  readonly status: AdapterRunStatus
  readonly error: string | null
  readonly startedAt: string
  readonly finishedAt: string
}

export async function recordAdapterRun(db: Client, record: AdapterRunRecord): Promise<void> {
  await db.execute({
    sql: `INSERT INTO pay_index_adapter_runs
            (run_id, adapter_id, job_id, city_id, period, rows_returned, status, error, started_at, finished_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      record.runId,
      record.adapterId,
      record.jobId,
      record.cityId,
      record.period,
      record.rowsReturned,
      record.status,
      record.error,
      record.startedAt,
      record.finishedAt,
    ],
  })
}

// Resumability: a task (adapter x job x city) that already completed
// (successfully or with a clean zero-rows result) for this run is skipped
// on a re-invocation. A task that previously errored is retried.
export async function isTaskAlreadyDone(db: Client, runId: string, adapterId: string, jobId: string, cityId: string): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT 1 FROM pay_index_adapter_runs
          WHERE run_id = ? AND adapter_id = ? AND job_id = ? AND city_id = ? AND status IN ('ok', 'zero_rows')
          LIMIT 1`,
    args: [runId, adapterId, jobId, cityId],
  })
  return result.rows.length > 0
}
