import { describe, expect, it } from 'vitest'
import { vivianAdapter } from '../../../netlify/functions/_lib/payindex/adapters/roles/vivian'
import type { AdapterContext } from '../../../netlify/functions/_lib/payindex/adapters/index'
import { jobs } from '../../../src/data/payIndex/jobs'
import { cities } from '../../../src/data/payIndex/cities'

const registeredNurse = jobs.find((j) => j.id === 'registered-nurse')!
const houston = cities.find((c) => c.id === 'houston-tx')!

const SYNTHETIC_RESPONSE = {
  results: [
    { id: 'v1', url: 'https://www.vivian.com/job/v1', location: 'Houston, TX', weeklyPay: 2600 },
    { id: 'v2', url: 'https://www.vivian.com/job/v2', location: 'Denver, CO', weeklyPay: 2400 },
    { id: 'v3', url: 'https://www.vivian.com/job/v3', location: 'Houston, TX', hourlyRate: 48 },
    { id: 'v4', url: 'https://www.vivian.com/job/v4', location: 'Houston, TX' }, // no pay figure
  ],
}

function stubContext(): AdapterContext {
  return {
    period: '2026-07',
    http: {
      fetchText: async () => {
        throw new Error('not used')
      },
      fetchJson: async <T>(): Promise<T> => SYNTHETIC_RESPONSE as T,
    },
    log: () => {},
  }
}

describe('vivianAdapter', () => {
  it('annualizes weekly pay and passes through an hourly rate, matched to the requested city only', async () => {
    const observations = await vivianAdapter.fetchObservations(registeredNurse, houston, '2026-07', stubContext())
    expect(observations).toHaveLength(2)
    const byKind = observations.sort((a, b) => a.observationKey.localeCompare(b.observationKey))
    expect(byKind.some((o) => o.payBasis === 'annual' && o.rawPoint === 2600 * 52)).toBe(true)
    expect(byKind.some((o) => o.payBasis === 'hourly' && o.rawPoint === 48)).toBe(true)
    expect(observations.every((o) => o.cityId === 'houston-tx')).toBe(true)
  })

  it('excludes listings for a different city', async () => {
    const observations = await vivianAdapter.fetchObservations(registeredNurse, houston, '2026-07', stubContext())
    expect(observations.every((o) => o.sourceUrl !== 'https://www.vivian.com/job/v2')).toBe(true)
  })
})
