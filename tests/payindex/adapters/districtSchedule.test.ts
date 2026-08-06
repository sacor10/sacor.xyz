import { describe, expect, it } from 'vitest'
import { districtScheduleAdapter } from '../../../netlify/functions/_lib/payindex/adapters/roles/districtSchedule'
import type { AdapterContext } from '../../../netlify/functions/_lib/payindex/adapters/index'
import { jobs } from '../../../src/data/payIndex/jobs'
import { cities } from '../../../src/data/payIndex/cities'

const elementaryTeacher = jobs.find((j) => j.id === 'elementary-school-teacher')!
const losAngeles = cities.find((c) => c.id === 'los-angeles-ca')!

const SYNTHETIC_SCHEDULE_HTML = `
<table>
  <tr><th>Step</th><th>Annual Salary</th></tr>
  <tr><td>Step 1</td><td>$58,000 annually</td></tr>
  <tr><td>Step 2</td><td>$61,500 annually</td></tr>
  <tr><td>Step 10</td><td>$92,000 annually</td></tr>
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

describe('districtScheduleAdapter', () => {
  it('emits one annual-basis observation per step', async () => {
    const observations = await districtScheduleAdapter.fetchObservations(
      elementaryTeacher,
      losAngeles,
      '2026-07',
      stubContext(SYNTHETIC_SCHEDULE_HTML),
    )
    expect(observations).toHaveLength(3)
    expect(observations.every((o) => o.payBasis === 'annual')).toBe(true)
    expect(observations.every((o) => o.sourceKind === 'scale')).toBe(true)
    expect(observations.map((o) => o.rawPoint).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([58000, 61500, 92000])
  })

  it('covers() is false for a (job, city) pair with no registry entry', () => {
    const secondaryTeacher = jobs.find((j) => j.id === 'secondary-school-teacher')!
    expect(districtScheduleAdapter.covers(secondaryTeacher, losAngeles)).toBe(false)
  })
})
