import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { workdayAdapter } from '../../../netlify/functions/_lib/payindex/adapters/ats/workday'
import type { AdapterContext } from '../../../netlify/functions/_lib/payindex/adapters/index'
import { jobs } from '../../../src/data/payIndex/jobs'
import { cities } from '../../../src/data/payIndex/cities'
import { workdayBoards } from '../../../src/data/payIndex/atsBoards'

const softwareDeveloper = jobs.find((j) => j.id === 'software-developer')!
const sanFrancisco = cities.find((c) => c.id === 'san-francisco-ca')!

const searchFixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/workday-search.json'), 'utf8'))
const detailFixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/workday-detail.json'), 'utf8'))

function stubContext(): AdapterContext {
  return {
    period: '2026-07',
    http: {
      fetchText: async () => {
        throw new Error('not used')
      },
      fetchJson: async <T>(url: string, init?: RequestInit): Promise<T> => {
        if (init?.method === 'POST') return searchFixture as T
        if (url.includes('R12345')) return detailFixture as T
        return { jobPostingInfo: {} } as T
      },
    },
    log: () => {},
  }
}

describe('workdayAdapter', () => {
  it('performs the two-step search then detail fetch and parses the description band', async () => {
    const observations = await workdayAdapter.fetchObservations(softwareDeveloper, sanFrancisco, '2026-07', stubContext())
    // Two postings match title, only the San Francisco one matches the
    // requested city; the Denver one is filtered by matchesCity before any
    // detail fetch would even matter.
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({
      sourceId: 'ats-workday',
      rawMin: 170000,
      rawMax: 210000,
      payBasis: 'annual',
      observationKey: `ats:workday:${workdayBoards[0].tenant}:/job/San-Francisco-CA/Software-Developer-II_R12345`,
    })
  })

  it('degrades to zero rows (not a throw) when the detail fetch fails for a matched posting', async () => {
    const ctx: AdapterContext = {
      period: '2026-07',
      http: {
        fetchText: async () => {
          throw new Error('not used')
        },
        fetchJson: async <T>(_url: string, init?: RequestInit): Promise<T> => {
          if (init?.method === 'POST') return searchFixture as T
          throw new Error('simulated detail fetch failure')
        },
      },
      log: () => {},
    }
    const observations = await workdayAdapter.fetchObservations(softwareDeveloper, sanFrancisco, '2026-07', ctx)
    expect(observations).toEqual([])
  })
})
