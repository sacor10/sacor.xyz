import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { adzunaAdapter } from '../../../netlify/functions/_lib/payindex/adapters/adzuna'
import type { AdapterContext } from '../../../netlify/functions/_lib/payindex/adapters/index'
import { jobs } from '../../../src/data/payIndex/jobs'
import { cities } from '../../../src/data/payIndex/cities'

const retailCashier = jobs.find((j) => j.id === 'retail-cashier')!
const newYork = cities.find((c) => c.id === 'new-york-ny')!

const fixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/adzuna-search.json'), 'utf8'))

function stubContext(response: unknown): AdapterContext {
  return {
    period: '2026-07',
    http: {
      fetchText: async () => {
        throw new Error('adzuna adapter should only call fetchJson')
      },
      fetchJson: async <T>() => response as T,
    },
    log: () => {},
  }
}

describe('adzunaAdapter', () => {
  beforeEach(() => {
    process.env.ADZUNA_APP_ID = 'test-app-id'
    process.env.ADZUNA_APP_KEY = 'test-app-key'
  })

  afterEach(() => {
    delete process.env.ADZUNA_APP_ID
    delete process.env.ADZUNA_APP_KEY
  })

  it('covers every basket cell', () => {
    expect(adzunaAdapter.covers(retailCashier, newYork)).toBe(true)
  })

  it('preflight() throws a descriptive error when credentials are missing', async () => {
    delete process.env.ADZUNA_APP_ID
    await expect(adzunaAdapter.preflight()).rejects.toThrow(/ADZUNA_APP_ID/)
  })

  it('preflight() resolves when credentials are present', async () => {
    await expect(adzunaAdapter.preflight()).resolves.toBeUndefined()
  })

  it('fetchObservations() drops predicted-salary rows, mismatched titles, wrong cities, and incomplete rows', async () => {
    const observations = await adzunaAdapter.fetchObservations(
      retailCashier,
      newYork,
      '2026-07',
      stubContext(fixture),
    )

    // Fixture has 5 results: only #1001 is a real posting matching this
    // exact job and city with a disclosed (non-predicted) salary range.
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({
      sourceId: 'adzuna',
      sourceKind: 'posting',
      jobId: 'retail-cashier',
      cityId: 'new-york-ny',
      period: '2026-07',
      rawMin: 30000,
      rawMax: 34000,
      payBasis: 'annual',
      observationKey: 'adzuna:2026-07:1001',
    })
  })

  it('fetchObservations() returns an empty array, not a throw, when the search has no results', async () => {
    const observations = await adzunaAdapter.fetchObservations(
      retailCashier,
      newYork,
      '2026-07',
      stubContext({ count: 0, results: [] }),
    )
    expect(observations).toEqual([])
  })
})
