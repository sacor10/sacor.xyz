import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ashbyAdapter } from '../../../netlify/functions/_lib/payindex/adapters/ats/ashby'
import type { AdapterContext } from '../../../netlify/functions/_lib/payindex/adapters/index'
import { jobs } from '../../../src/data/payIndex/jobs'
import { cities } from '../../../src/data/payIndex/cities'
import { ashbyBoards } from '../../../src/data/payIndex/atsBoards'

const softwareDeveloper = jobs.find((j) => j.id === 'software-developer')!
const newYork = cities.find((c) => c.id === 'new-york-ny')!

const fixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/ashby-jobs.json'), 'utf8'))

function stubContext(): AdapterContext {
  return {
    period: '2026-07',
    http: {
      fetchText: async () => {
        throw new Error('not used')
      },
      fetchJson: async <T>(url: string): Promise<T> => {
        const rampToken = ashbyBoards[0].token
        if (url.includes(`/job-board/${rampToken}`)) return fixture as T
        return { jobs: [] } as T
      },
    },
    log: () => {},
  }
}

describe('ashbyAdapter', () => {
  it('uses the structured compensation.summaryComponents field', async () => {
    const observations = await ashbyAdapter.fetchObservations(softwareDeveloper, newYork, '2026-07', stubContext())
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({
      rawMin: 165000,
      rawMax: 205000,
      payBasis: 'annual',
      observationKey: `ats:ashby:2026-07:${ashbyBoards[0].token}:ashby-1`,
    })
  })

  it('skips a posting with no usable compensation component', async () => {
    const observations = await ashbyAdapter.fetchObservations(softwareDeveloper, newYork, '2026-07', stubContext())
    expect(observations.every((o) => o.observationKey !== `ats:ashby:2026-07:${ashbyBoards[0].token}:ashby-2`)).toBe(true)
  })
})
