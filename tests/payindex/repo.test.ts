import { createClient, type Client } from '@libsql/client'
import { describe, expect, it, beforeEach } from 'vitest'
import { ensureSchema } from '../../netlify/functions/_lib/payindex/schema'
import {
  insertObservation,
  insertObservations,
  computeAndStoreCellValue,
  getBaselinePeriod,
  setBaselinePeriodIfUnset,
  computeAndStoreSnapshot,
  recordAdapterRun,
  isTaskAlreadyDone,
} from '../../netlify/functions/_lib/payindex/repo'
import type { Observation } from '../../netlify/functions/_lib/payindex/types'

async function freshDb(): Promise<Client> {
  const db = createClient({ url: ':memory:' })
  await ensureSchema(db)
  return db
}

function obs(overrides: Partial<Observation> & { observationKey: string }): Observation {
  return {
    sourceId: 'adzuna',
    sourceKind: 'posting',
    jobId: 'retail-cashier',
    cityId: 'new-york-ny',
    period: '2026-07',
    rawMin: 30000,
    rawMax: 34000,
    rawPoint: null,
    payBasis: 'annual',
    sourceUrl: 'https://example.com',
    fetchedAt: '2026-07-01T00:00:00.000Z',
    sampleSize: 1,
    ...overrides,
  }
}

describe('insertObservation', () => {
  let db: Client
  beforeEach(async () => {
    db = await freshDb()
  })

  it('normalizes hourly pay to annual on insert', async () => {
    await insertObservation(db, obs({ observationKey: 'k1', rawMin: 20, rawMax: 24, payBasis: 'hourly' }))
    const row = await db.execute({ sql: 'SELECT annual_point FROM pay_index_observations WHERE observation_key = ?', args: ['k1'] })
    expect(row.rows[0].annual_point).toBe(22 * 2080)
  })

  it('is idempotent: re-inserting the same observationKey does not duplicate the row', async () => {
    const first = await insertObservation(db, obs({ observationKey: 'dup-1' }))
    const second = await insertObservation(db, obs({ observationKey: 'dup-1' }))
    expect(first).toBe(true)
    expect(second).toBe(false)
    const count = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM pay_index_observations WHERE observation_key = ?', args: ['dup-1'] })
    expect(Number(count.rows[0].n)).toBe(1)
  })
})

describe('computeAndStoreCellValue', () => {
  let db: Client
  beforeEach(async () => {
    db = await freshDb()
  })

  it('writes a gap row when there are no observations', async () => {
    const cell = await computeAndStoreCellValue(db, 'retail-cashier', 'new-york-ny', '2026-07')
    expect(cell.status).toBe('gap_no_data')
    const row = await db.execute({
      sql: 'SELECT status, median_annual_pay FROM pay_index_cell_values WHERE job_id=? AND city_id=? AND period=?',
      args: ['retail-cashier', 'new-york-ny', '2026-07'],
    })
    expect(row.rows[0].status).toBe('gap_no_data')
    expect(row.rows[0].median_annual_pay).toBeNull()
  })

  it('writes an included cell once >=5 posting observations exist', async () => {
    await insertObservations(db, [
      obs({ observationKey: 'a', rawMin: 30000, rawMax: 30000 }),
      obs({ observationKey: 'b', rawMin: 31000, rawMax: 31000 }),
      obs({ observationKey: 'c', rawMin: 32000, rawMax: 32000 }),
      obs({ observationKey: 'd', rawMin: 33000, rawMax: 33000 }),
      obs({ observationKey: 'e', rawMin: 34000, rawMax: 34000 }),
    ])
    const cell = await computeAndStoreCellValue(db, 'retail-cashier', 'new-york-ny', '2026-07')
    expect(cell.status).toBe('included')
    expect(cell.medianAnnualPay).toBe(32000)
    expect(cell.observationCount).toBe(5)
  })

  it('excludes aggregate-kind sources (e.g. levelsfyi) from the pool, matching aggregate.ts', async () => {
    await insertObservations(db, [
      obs({ observationKey: 'a', rawMin: 30000, rawMax: 30000 }),
      obs({ observationKey: 'b', rawMin: 31000, rawMax: 31000 }),
      obs({ observationKey: 'c', rawMin: 32000, rawMax: 32000 }),
      obs({ observationKey: 'd', rawMin: 33000, rawMax: 33000 }),
      obs({ observationKey: 'agg', sourceId: 'levelsfyi', sourceKind: 'aggregate', rawMin: 500000, rawMax: 500000 }),
    ])
    // Only 4 real postings -> below threshold even though 5 rows exist.
    const cell = await computeAndStoreCellValue(db, 'retail-cashier', 'new-york-ny', '2026-07')
    expect(cell.status).toBe('gap_below_threshold')
    expect(cell.observationCount).toBe(4)
  })
})

describe('baseline period', () => {
  let db: Client
  beforeEach(async () => {
    db = await freshDb()
  })

  it('is null until set', async () => {
    expect(await getBaselinePeriod(db)).toBeNull()
  })

  it('is set exactly once and never moves', async () => {
    await setBaselinePeriodIfUnset(db, '2026-07')
    await setBaselinePeriodIfUnset(db, '2026-08')
    expect(await getBaselinePeriod(db)).toBe('2026-07')
  })
})

describe('computeAndStoreSnapshot', () => {
  let db: Client
  beforeEach(async () => {
    db = await freshDb()
  })

  it('returns null when no baseline is set', async () => {
    expect(await computeAndStoreSnapshot(db, '2026-07')).toBeNull()
  })

  it('returns null (no headline figure) when the period IS the baseline itself', async () => {
    await setBaselinePeriodIfUnset(db, '2026-07')
    expect(await computeAndStoreSnapshot(db, '2026-07')).toBeNull()
  })

  it('computes a real snapshot once a later period has cell data', async () => {
    await setBaselinePeriodIfUnset(db, '2026-01')
    await insertObservations(db, [
      obs({ observationKey: 'base-a', period: '2026-01', rawMin: 100, rawMax: 100 }),
      obs({ observationKey: 'base-b', period: '2026-01', rawMin: 100, rawMax: 100 }),
      obs({ observationKey: 'base-c', period: '2026-01', rawMin: 100, rawMax: 100 }),
      obs({ observationKey: 'base-d', period: '2026-01', rawMin: 100, rawMax: 100 }),
      obs({ observationKey: 'base-e', period: '2026-01', rawMin: 100, rawMax: 100 }),
    ])
    await insertObservations(db, [
      obs({ observationKey: 'cur-a', period: '2026-07', rawMin: 110, rawMax: 110 }),
      obs({ observationKey: 'cur-b', period: '2026-07', rawMin: 110, rawMax: 110 }),
      obs({ observationKey: 'cur-c', period: '2026-07', rawMin: 110, rawMax: 110 }),
      obs({ observationKey: 'cur-d', period: '2026-07', rawMin: 110, rawMax: 110 }),
      obs({ observationKey: 'cur-e', period: '2026-07', rawMin: 110, rawMax: 110 }),
    ])
    await computeAndStoreCellValue(db, 'retail-cashier', 'new-york-ny', '2026-01')
    await computeAndStoreCellValue(db, 'retail-cashier', 'new-york-ny', '2026-07')

    const snapshot = await computeAndStoreSnapshot(db, '2026-07')
    expect(snapshot).not.toBeNull()
    // This one cell is +10%; every other basket cell (of 60x25=1500) is a
    // gap in both periods, so it dominates neither the mean nor coverage —
    // this asserts the snapshot machinery runs end-to-end against the real
    // basket size, not a mocked-down one.
    expect(snapshot!.cellsTotal).toBe(1500)
    expect(snapshot!.cellsIncluded).toBe(1)
    expect(snapshot!.mean).toBeCloseTo(0.1, 10)

    const row = await db.execute({
      sql: 'SELECT cells_included, cells_missing, cells_total FROM pay_index_snapshots WHERE period = ?',
      args: ['2026-07'],
    })
    expect(row.rows[0].cells_included).toBe(1)
    expect(Number(row.rows[0].cells_missing) + Number(row.rows[0].cells_included)).toBe(1500)
  })
})

describe('adapter run recording and resumability', () => {
  let db: Client
  beforeEach(async () => {
    db = await freshDb()
  })

  it('a task is not "already done" until an ok/zero_rows run is recorded', async () => {
    expect(await isTaskAlreadyDone(db, 'run-1', 'adzuna', 'retail-cashier', 'new-york-ny')).toBe(false)
    await recordAdapterRun(db, {
      runId: 'run-1',
      adapterId: 'adzuna',
      jobId: 'retail-cashier',
      cityId: 'new-york-ny',
      period: '2026-07',
      rowsReturned: 3,
      status: 'ok',
      error: null,
      startedAt: '2026-07-01T00:00:00.000Z',
      finishedAt: '2026-07-01T00:00:01.000Z',
    })
    expect(await isTaskAlreadyDone(db, 'run-1', 'adzuna', 'retail-cashier', 'new-york-ny')).toBe(true)
  })

  it('an errored task is NOT considered done, so a resumed run retries it', async () => {
    await recordAdapterRun(db, {
      runId: 'run-1',
      adapterId: 'adzuna',
      jobId: 'retail-cashier',
      cityId: 'new-york-ny',
      period: '2026-07',
      rowsReturned: 0,
      status: 'error',
      error: 'simulated failure',
      startedAt: '2026-07-01T00:00:00.000Z',
      finishedAt: '2026-07-01T00:00:01.000Z',
    })
    expect(await isTaskAlreadyDone(db, 'run-1', 'adzuna', 'retail-cashier', 'new-york-ny')).toBe(false)
  })
})
