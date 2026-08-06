import { describe, expect, it } from 'vitest'
import { unionScaleAdapter } from '../../../netlify/functions/_lib/payindex/adapters/roles/unionScale'
import type { AdapterContext } from '../../../netlify/functions/_lib/payindex/adapters/index'
import { jobs } from '../../../src/data/payIndex/jobs'
import { cities } from '../../../src/data/payIndex/cities'
import { unionScaleEntries } from '../../../src/data/payIndex/roleSources'

const journeymanElectrician = jobs.find((j) => j.id === 'journeyman-electrician')!
const newYork = cities.find((c) => c.id === 'new-york-ny')!
const entry = unionScaleEntries.find((e) => e.jobId === 'journeyman-electrician' && e.cityId === 'new-york-ny')!

// A synthetic wage-scale-style table — structurally representative of a
// typical published scale, not a copy of any real page.
const SYNTHETIC_SCALE_HTML = `
<table>
  <tr><th>Classification</th><th>Rate</th></tr>
  <tr><td>1st Year Apprentice</td><td>$28.50 per hour</td></tr>
  <tr><td>2nd Year Apprentice</td><td>$34.00 per hour</td></tr>
  <tr><td>Journeyman Wireman</td><td>$58.75 per hour</td></tr>
  <tr><td>Notes</td><td>Rates effective through June 2027.</td></tr>
</table>
`

function stubContext(html: string): AdapterContext {
  return {
    period: '2026-07',
    http: {
      fetchText: async () => html,
      fetchJson: async () => {
        throw new Error('not used')
      },
    },
    log: () => {},
  }
}

describe('unionScaleAdapter', () => {
  it('covers only the configured (job, city) entries', () => {
    expect(unionScaleAdapter.covers(journeymanElectrician, newYork)).toBe(true)
    const unrelatedJob = jobs.find((j) => j.id === 'line-cook')!
    expect(unionScaleAdapter.covers(unrelatedJob, newYork)).toBe(false)
  })

  it('emits one observation per parsable table row, skipping rows with no rate', async () => {
    const observations = await unionScaleAdapter.fetchObservations(
      journeymanElectrician,
      newYork,
      '2026-07',
      stubContext(SYNTHETIC_SCALE_HTML),
    )
    // 3 rate rows parse (header row and the notes row do not).
    expect(observations).toHaveLength(3)
    expect(observations.every((o) => o.sourceKind === 'scale')).toBe(true)
    expect(observations.every((o) => o.payBasis === 'hourly')).toBe(true)
    expect(observations.map((o) => o.rawPoint).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([28.5, 34, 58.75])
    expect(observations.every((o) => o.sourceUrl === entry.url)).toBe(true)
  })

  it('returns an empty array (a gap), not a throw, when the page has no parsable rate', async () => {
    const observations = await unionScaleAdapter.fetchObservations(
      journeymanElectrician,
      newYork,
      '2026-07',
      stubContext('<p>Page temporarily unavailable.</p>'),
    )
    expect(observations).toEqual([])
  })

  it('returns an empty array, not a throw, when the fetch itself fails', async () => {
    const ctx: AdapterContext = {
      period: '2026-07',
      http: {
        fetchText: async () => {
          throw new Error('simulated network failure')
        },
        fetchJson: async () => {
          throw new Error('not used')
        },
      },
      log: () => {},
    }
    const observations = await unionScaleAdapter.fetchObservations(journeymanElectrician, newYork, '2026-07', ctx)
    expect(observations).toEqual([])
  })
})
