import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { leverAdapter } from '../../../netlify/functions/_lib/payindex/adapters/ats/lever'
import type { AdapterContext } from '../../../netlify/functions/_lib/payindex/adapters/index'
import { jobs } from '../../../src/data/payIndex/jobs'
import { cities } from '../../../src/data/payIndex/cities'
import { leverBoards } from '../../../src/data/payIndex/atsBoards'

const softwareDeveloper = jobs.find((j) => j.id === 'software-developer')!
const austin = cities.find((c) => c.id === 'austin-tx')!

const fixture = JSON.parse(readFileSync(join(__dirname, '../fixtures/lever-postings.json'), 'utf8'))

function stubContext(): AdapterContext {
  return {
    period: '2026-07',
    http: {
      fetchText: async () => {
        throw new Error('not used')
      },
      fetchJson: async <T>(url: string): Promise<T> => {
        const netflixToken = leverBoards[0].token
        if (url.includes(`/${netflixToken}?`)) return fixture as T
        return [] as T
      },
    },
    log: () => {},
  }
}

describe('leverAdapter', () => {
  it('uses the structured salaryRange field when present', async () => {
    const losGatos = { ...austin, id: 'los-gatos-fake', name: 'Los Gatos, CA' }
    const observations = await leverAdapter.fetchObservations(softwareDeveloper, losGatos, '2026-07', stubContext())
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({ rawMin: 140000, rawMax: 180000, payBasis: 'annual', observationKey: `ats:lever:2026-07:${leverBoards[0].token}:abc-123` })
  })

  it('falls back to parsing descriptionPlain when there is no structured salaryRange', async () => {
    const observations = await leverAdapter.fetchObservations(softwareDeveloper, austin, '2026-07', stubContext())
    // Austin has two candidate postings for this job: def-456 (hourly text,
    // no structured range) and jkl-012 (remote, rejected by matchesCity).
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({ rawMin: 60, rawMax: 75, payBasis: 'hourly', observationKey: `ats:lever:2026-07:${leverBoards[0].token}:def-456` })
  })

  it('excludes a title that does not match the job keywords', async () => {
    const observations = await leverAdapter.fetchObservations(softwareDeveloper, austin, '2026-07', stubContext())
    expect(observations.every((o) => o.observationKey !== `ats:lever:2026-07:${leverBoards[0].token}:ghi-789`)).toBe(true)
  })
})
