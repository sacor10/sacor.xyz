import { describe, expect, it } from 'vitest'
import { levelsFyiAdapter } from '../../../netlify/functions/_lib/payindex/adapters/roles/levelsfyi'
import type { AdapterContext } from '../../../netlify/functions/_lib/payindex/adapters/index'
import { jobs } from '../../../src/data/payIndex/jobs'
import { cities } from '../../../src/data/payIndex/cities'
import { levelsFyiEntries } from '../../../src/data/payIndex/roleSources'

const softwareDeveloper = jobs.find((j) => j.id === 'software-developer')!
const sanFrancisco = cities.find((c) => c.id === 'san-francisco-ca')!
const denver = cities.find((c) => c.id === 'denver-co')!
// Two configured entries are pinned to san-francisco-ca (stripe, salesforce)
// — pin the fixture to just stripe's slug so these tests exercise exactly
// one company's table instead of two.
const stripeEntry = levelsFyiEntries.find((e) => e.id === 'levelsfyi-stripe-swe')!

// Structurally representative of a markdown salary table — not a copy of
// any real page (the actual format isn't publicly documented).
const SYNTHETIC_MARKDOWN = `# Stripe Salaries

| Level | Median Total Comp |
| --- | --- |
| L3 | $210K |
| L4 | $285K |
| L5 | $410K |
`

function stubContext(): AdapterContext {
  return {
    period: '2026-07',
    http: {
      fetchText: async (url: string) =>
        url.includes(`/${stripeEntry.companySlug}/`) ? SYNTHETIC_MARKDOWN : '# No data\n',
      fetchJson: async () => {
        throw new Error('not used')
      },
    },
    log: () => {},
  }
}

describe('levelsFyiAdapter', () => {
  it('parses the markdown table and marks every row sourceKind: aggregate', async () => {
    const observations = await levelsFyiAdapter.fetchObservations(softwareDeveloper, sanFrancisco, '2026-07', stubContext())
    expect(observations).toHaveLength(3)
    expect(observations.every((o) => o.sourceKind === 'aggregate')).toBe(true)
    expect(observations.every((o) => o.sourceId === 'levelsfyi')).toBe(true)
    expect(observations.map((o) => o.rawPoint).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([210000, 285000, 410000])
  })

  it('only attributes an entry to its configured city, never duplicated across every basket city', async () => {
    expect(levelsFyiAdapter.covers(softwareDeveloper, denver)).toBe(false)
    const observations = await levelsFyiAdapter.fetchObservations(softwareDeveloper, denver, '2026-07', stubContext())
    expect(observations).toEqual([])
  })

  it("matches sources.ts's registered entries", () => {
    expect(levelsFyiEntries.every((e) => e.jobId === 'software-developer')).toBe(true)
  })
})
