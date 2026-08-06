// Tier B, platform 3 of 4: Ashby. Public per-employer job board API with
// `includeCompensation=true` — the cleanest of the four platforms, since
// compensation is a structured field rather than something to parse out of
// description text.

import type { Job, City } from '../../../../../../src/data/payIndex/types.ts'
import { ashbyBoards } from '../../../../../../src/data/payIndex/atsBoards.ts'
import type { Observation } from '../../types.ts'
import type { SourceAdapter, AdapterContext } from '../index.ts'
import { matchesJob, matchesCity } from '../../matching.ts'

interface AshbyCompensationComponent {
  readonly minValue?: number
  readonly maxValue?: number
  readonly interval?: string
}

interface AshbyJob {
  readonly id: string
  readonly title: string
  readonly jobUrl: string
  readonly location?: string
  readonly compensation?: { readonly summaryComponents?: readonly AshbyCompensationComponent[] }
}

interface AshbyBoardResponse {
  readonly jobs: readonly AshbyJob[]
}

function firstUsableComponent(job: AshbyJob): AshbyCompensationComponent | null {
  const components = job.compensation?.summaryComponents ?? []
  return (
    components.find(
      (c) => typeof c.minValue === 'number' && typeof c.maxValue === 'number' && c.maxValue >= c.minValue && c.minValue > 0,
    ) ?? null
  )
}

export const ashbyAdapter: SourceAdapter = {
  id: 'ats-ashby',
  tier: 'B',
  sourceIds: ['ats-ashby'],

  async preflight() {
    // Public API, no credentials required.
  },

  covers() {
    return ashbyBoards.length > 0
  },

  async fetchObservations(job: Job, city: City, period: string, ctx: AdapterContext): Promise<Observation[]> {
    const observations: Observation[] = []

    for (const board of ashbyBoards) {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${board.token}?includeCompensation=true`
      let response: AshbyBoardResponse
      try {
        response = await ctx.http.fetchJson<AshbyBoardResponse>(url)
      } catch (err) {
        ctx.log('ats-ashby.board_fetch_failed', { employer: board.employer, token: board.token, error: String(err) })
        continue
      }

      for (const posting of response.jobs ?? []) {
        const title = posting.title ?? ''
        const location = posting.location ?? ''
        if (!matchesJob(title, job)) continue
        if (!matchesCity(location, city)) continue

        const component = firstUsableComponent(posting)
        if (!component || component.minValue === undefined || component.maxValue === undefined) continue

        const basis = /hour/i.test(component.interval ?? '') ? 'hourly' : 'annual'

        observations.push({
          sourceId: 'ats-ashby',
          sourceKind: 'posting',
          jobId: job.id,
          cityId: city.id,
          period,
          rawMin: component.minValue,
          rawMax: component.maxValue,
          rawPoint: null,
          payBasis: basis,
          sourceUrl: posting.jobUrl,
          fetchedAt: new Date().toISOString(),
          sampleSize: 1,
          observationKey: `ats:ashby:${board.token}:${posting.id}`,
        })
      }
    }

    ctx.log('ats-ashby.fetchObservations', { jobId: job.id, cityId: city.id, period, rows: observations.length })
    return observations
  },
}
