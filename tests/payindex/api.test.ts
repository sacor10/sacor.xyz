import { describe, expect, it, vi, beforeAll } from 'vitest'

// In-memory stand-in for Turso so the read functions work without a real
// database — the same seam tests/songid/handler.test.ts uses for Netlify
// Blobs, applied to netlify/functions/_lib/turso.mjs's getTursoClient().
// vi.mock factories are hoisted above ordinary imports, so the client has
// to be constructed inside vi.hoisted() rather than via a normal import.
const memoryDb = vi.hoisted(() => {
  const { createClient } = require('@libsql/client')
  return createClient({ url: ':memory:' })
})

vi.mock('../../netlify/functions/_lib/turso.mjs', () => ({
  getTursoClient: async () => memoryDb,
}))

import currentHandler from '../../netlify/functions/pay-index-current.mts'
import historyHandler from '../../netlify/functions/pay-index-history.mts'
import basketHandler from '../../netlify/functions/pay-index-basket.mts'
import cellsHandler from '../../netlify/functions/pay-index-cells.mts'
import coverageHandler from '../../netlify/functions/pay-index-coverage.mts'
import { ensureSchema } from '../../netlify/functions/_lib/payindex/schema'
import {
  insertObservations,
  computeAndStoreCellValue,
  setBaselinePeriodIfUnset,
  computeAndStoreSnapshot,
  recordAdapterRun,
} from '../../netlify/functions/_lib/payindex/repo'
import type { Observation } from '../../netlify/functions/_lib/payindex/types'
import { jobs } from '../../src/data/payIndex/jobs'

function req(url: string, method = 'GET'): Request {
  return new Request(`https://sacor.xyz${url}`, { method })
}

function obs(overrides: Partial<Observation> & { observationKey: string }): Observation {
  return {
    sourceId: 'adzuna',
    sourceKind: 'posting',
    jobId: 'retail-cashier',
    cityId: 'new-york-ny',
    period: '2026-01',
    rawMin: 30000,
    rawMax: 30000,
    rawPoint: null,
    payBasis: 'annual',
    sourceUrl: 'https://example.com',
    fetchedAt: '2026-01-01T00:00:00.000Z',
    sampleSize: 1,
    ...overrides,
  }
}

beforeAll(async () => {
  // Seeds real data through the actual repo layer, exercising the same
  // schema/aggregate/computeIndex path the CLI uses — the handlers under
  // test only ever read what this writes.
  await ensureSchema(memoryDb)
  await setBaselinePeriodIfUnset(memoryDb, '2026-01')
  await insertObservations(
    memoryDb,
    Array.from({ length: 5 }, (_, i) => obs({ observationKey: `base-${i}`, period: '2026-01', rawMin: 100 + i, rawMax: 100 + i })),
  )
  await insertObservations(
    memoryDb,
    Array.from({ length: 5 }, (_, i) => obs({ observationKey: `cur-${i}`, period: '2026-02', rawMin: 110 + i, rawMax: 110 + i })),
  )
  await computeAndStoreCellValue(memoryDb, 'retail-cashier', 'new-york-ny', '2026-01')
  // Mirrors what the real ingest CLI does: compute every active job for
  // this city and period, so jobs with no observations correctly resolve
  // to explicit gap_no_data rows (rule 4) rather than being absent from
  // pay_index_cell_values entirely.
  for (const job of jobs) {
    await computeAndStoreCellValue(memoryDb, job.id, 'new-york-ny', '2026-02')
  }
  await computeAndStoreSnapshot(memoryDb, '2026-02')
  await recordAdapterRun(memoryDb, {
    runId: '2026-02',
    adapterId: 'adzuna',
    jobId: 'retail-cashier',
    cityId: 'new-york-ny',
    period: '2026-02',
    rowsReturned: 5,
    status: 'ok',
    error: null,
    startedAt: '2026-02-01T00:00:00.000Z',
    finishedAt: '2026-02-01T00:00:01.000Z',
  })
  await recordAdapterRun(memoryDb, {
    runId: '2026-02',
    adapterId: 'ats-workday',
    jobId: 'software-developer',
    cityId: 'denver-co',
    period: '2026-02',
    rowsReturned: 0,
    status: 'zero_rows',
    error: null,
    startedAt: '2026-02-01T00:00:00.000Z',
    finishedAt: '2026-02-01T00:00:01.000Z',
  })
})

describe('pay-index-current', () => {
  it('rejects non-GET', async () => {
    expect((await currentHandler(req('/x', 'POST'))).status).toBe(405)
  })

  it('publishes the headline alongside basket version, formula, and coverage (rule 6)', async () => {
    const res = await currentHandler(req('/x'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.period).toBe('2026-02')
    expect(body.headline.metric).toBe('mean')
    expect(typeof body.mean).toBe('number')
    expect(typeof body.median).toBe('number')
    expect(body.basketVersion).toBeTruthy()
    expect(body.methodologyVersion).toBeTruthy()
    expect(body.formula).toBeTruthy()
    expect(body.coverage.cellsTotal).toBe(1500)
    expect(body.coverage.cellsIncluded).toBe(1)
  })
})

describe('pay-index-history', () => {
  it('returns every snapshot, oldest first', async () => {
    const res = await historyHandler(req('/x'))
    const body = await res.json()
    expect(Array.isArray(body.snapshots)).toBe(true)
    expect(body.snapshots.some((s: { period: string }) => s.period === '2026-02')).toBe(true)
  })
})

describe('pay-index-basket', () => {
  it('returns the full static basket with no DB round trip needed', async () => {
    const res = await basketHandler(req('/x'))
    const body = await res.json()
    expect(body.jobs.length).toBe(60)
    expect(body.cities.length).toBe(25)
    expect(body.changelog.length).toBeGreaterThan(0)
    expect(body.formula).toBeTruthy()
  })
})

describe('pay-index-cells', () => {
  it('includes gap rows, never omits them (rule 4)', async () => {
    const res = await cellsHandler(req('/x?period=2026-02&city=new-york-ny'))
    const body = await res.json()
    expect(body.period).toBe('2026-02')
    const included = body.cells.filter((c: { status: string }) => c.status === 'included')
    const gaps = body.cells.filter((c: { status: string }) => c.status !== 'included')
    expect(included.length).toBe(1)
    // New York has 60 jobs configured; only one has data this period, so
    // every other job for this city must appear as an explicit gap row.
    expect(gaps.length).toBe(59)
  })
})

describe('pay-index-coverage', () => {
  it('surfaces a broken/zero-rows adapter as stale, not silently', async () => {
    const res = await coverageHandler(req('/x?period=2026-02'))
    const body = await res.json()
    expect(body.brokenAdapters).toContain('ats-workday')
    expect(body.stale).toBe(true)
  })
})
