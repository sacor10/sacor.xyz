import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { greenhouseAdapter } from '../../../netlify/functions/_lib/payindex/adapters/ats/greenhouse'
import type { AdapterContext } from '../../../netlify/functions/_lib/payindex/adapters/index'
import { jobs } from '../../../src/data/payIndex/jobs'
import { cities } from '../../../src/data/payIndex/cities'
import { greenhouseBoards } from '../../../src/data/payIndex/atsBoards'

const softwareDeveloper = jobs.find((j) => j.id === 'software-developer')!
const sanFrancisco = cities.find((c) => c.id === 'san-francisco-ca')!

const fixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/greenhouse-jobs.json'), 'utf8'))

function stubContext(): AdapterContext {
  return {
    period: '2026-07',
    http: {
      fetchText: async () => {
        throw new Error('not used')
      },
      fetchJson: async <T>(url: string): Promise<T> => {
        // Only the first configured board ("stripe") returns real postings;
        // every other board returns empty, so exactly one match is possible.
        const stripeToken = greenhouseBoards[0].token
        if (url.includes(`/boards/${stripeToken}/`)) return fixture as T
        return { jobs: [] } as T
      },
    },
    log: () => {},
  }
}

describe('greenhouseAdapter', () => {
  it('matches on title and city, and requires a parsable pay band', async () => {
    const observations = await greenhouseAdapter.fetchObservations(
      softwareDeveloper,
      sanFrancisco,
      '2026-07',
      stubContext(),
    )
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({
      sourceId: 'ats-greenhouse',
      sourceKind: 'posting',
      jobId: 'software-developer',
      cityId: 'san-francisco-ca',
      rawMin: 150000,
      rawMax: 190000,
      payBasis: 'annual',
      observationKey: `ats:greenhouse:${greenhouseBoards[0].token}:111`,
    })
  })

  it('covers() is true whenever at least one board is configured', () => {
    expect(greenhouseAdapter.covers(softwareDeveloper, sanFrancisco)).toBe(true)
  })
})
