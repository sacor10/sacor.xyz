// Tier B, platform 1 of 4: Greenhouse. Public per-employer job board JSON
// API — no auth. Pay bands (where present, per pay-transparency laws) live
// in the posting's free-text `content` HTML, so this goes through the
// shared parsePayBand parser.
//
// Every basket (job, city) call requests the SAME board URL per employer —
// deliberately. The shared HTTP layer's disk cache (http.ts) collapses
// that into one real network request per board per ingest run; this
// adapter does not attempt its own per-board caching.

import type { Job, City } from '../../../../../../src/data/payIndex/types.ts'
import { greenhouseBoards } from '../../../../../../src/data/payIndex/atsBoards.ts'
import type { Observation } from '../../types.ts'
import type { SourceAdapter, AdapterContext } from '../index.ts'
import { matchesJob, matchesCity } from '../../matching.ts'
import { parsePayBand } from './parseBand.ts'
import { stripHtml } from './common.ts'

interface GreenhouseJob {
  readonly id: number
  readonly title: string
  readonly absolute_url: string
  readonly content?: string
  readonly location?: { readonly name?: string }
}

interface GreenhouseBoardResponse {
  readonly jobs: readonly GreenhouseJob[]
}

export const greenhouseAdapter: SourceAdapter = {
  id: 'ats-greenhouse',
  tier: 'B',
  sourceIds: ['ats-greenhouse'],

  async preflight() {
    // Public API, no credentials required.
  },

  covers() {
    return greenhouseBoards.length > 0
  },

  async fetchObservations(job: Job, city: City, period: string, ctx: AdapterContext): Promise<Observation[]> {
    const observations: Observation[] = []

    for (const board of greenhouseBoards) {
      const url = `https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs?content=true`
      let response: GreenhouseBoardResponse
      try {
        response = await ctx.http.fetchJson<GreenhouseBoardResponse>(url)
      } catch (err) {
        ctx.log('ats-greenhouse.board_fetch_failed', { employer: board.employer, token: board.token, error: String(err) })
        continue
      }

      for (const posting of response.jobs ?? []) {
        const title = posting.title ?? ''
        const location = posting.location?.name ?? ''
        if (!matchesJob(title, job)) continue
        if (!matchesCity(location, city)) continue

        const band = parsePayBand(stripHtml(posting.content ?? ''))
        if (!band) continue

        observations.push({
          sourceId: 'ats-greenhouse',
          sourceKind: 'posting',
          jobId: job.id,
          cityId: city.id,
          period,
          rawMin: band.min,
          rawMax: band.max,
          rawPoint: null,
          payBasis: band.basis,
          sourceUrl: posting.absolute_url,
          fetchedAt: new Date().toISOString(),
          sampleSize: 1,
          // Period-scoped — see the comment on the equivalent line in
          // adapters/adzuna.ts for why.
          observationKey: `ats:greenhouse:${period}:${board.token}:${posting.id}`,
        })
      }
    }

    ctx.log('ats-greenhouse.fetchObservations', { jobId: job.id, cityId: city.id, period, rows: observations.length })
    return observations
  },
}
