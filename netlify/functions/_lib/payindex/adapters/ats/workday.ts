// Tier B, platform 4 of 4: Workday. The brittlest of the four — an
// undocumented `cxs` endpoint, per-tenant data-center subdomains, and pay
// bands buried in description HTML behind a second request per posting.
// Expect this one to break first; that's exactly what pay_index_adapter_runs
// (rows_returned/status) and the ingest CLI's zero-rows alerting exist to
// surface (methodology rule 8) rather than let it fail silently.

import type { Job, City } from '../../../../../../src/data/payIndex/types.ts'
import { workdayBoards, type WorkdayBoard } from '../../../../../../src/data/payIndex/atsBoards.ts'
import type { Observation } from '../../types.ts'
import type { SourceAdapter, AdapterContext } from '../index.ts'
import { matchesJob, matchesCity } from '../../matching.ts'
import { parsePayBand } from './parseBand.ts'
import { stripHtml } from './common.ts'

interface WorkdaySearchPosting {
  readonly title: string
  readonly externalPath: string
  readonly locationsText?: string
  readonly bulletFields?: readonly string[]
}

interface WorkdaySearchResponse {
  readonly jobPostings: readonly WorkdaySearchPosting[]
}

interface WorkdayPostingDetail {
  readonly jobPostingInfo?: {
    readonly jobDescription?: string
    readonly externalUrl?: string
  }
}

function baseUrl(board: WorkdayBoard): string {
  return `https://${board.tenant}.${board.dataCenter}.myworkdayjobs.com/wday/cxs/${board.tenant}/${board.site}`
}

export const workdayAdapter: SourceAdapter = {
  id: 'ats-workday',
  tier: 'B',
  sourceIds: ['ats-workday'],

  async preflight() {
    // Public endpoint, no credentials required.
  },

  covers() {
    return workdayBoards.length > 0
  },

  async fetchObservations(job: Job, city: City, period: string, ctx: AdapterContext): Promise<Observation[]> {
    const observations: Observation[] = []

    for (const board of workdayBoards) {
      const searchUrl = `${baseUrl(board)}/jobs`
      let search: WorkdaySearchResponse
      try {
        search = await ctx.http.fetchJson<WorkdaySearchResponse>(searchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: job.canonicalKeywords[0] }),
        })
      } catch (err) {
        ctx.log('ats-workday.search_failed', { employer: board.employer, tenant: board.tenant, error: String(err) })
        continue
      }

      for (const posting of search.jobPostings ?? []) {
        const title = posting.title ?? ''
        const location = posting.locationsText ?? ''
        if (!matchesJob(title, job)) continue
        if (!matchesCity(location, city)) continue

        const detailUrl = `${baseUrl(board)}${posting.externalPath}`
        let detail: WorkdayPostingDetail
        try {
          detail = await ctx.http.fetchJson<WorkdayPostingDetail>(detailUrl)
        } catch (err) {
          ctx.log('ats-workday.detail_fetch_failed', { employer: board.employer, path: posting.externalPath, error: String(err) })
          continue
        }

        const description = detail.jobPostingInfo?.jobDescription ?? ''
        const band = parsePayBand(stripHtml(description))
        if (!band) continue

        observations.push({
          sourceId: 'ats-workday',
          sourceKind: 'posting',
          jobId: job.id,
          cityId: city.id,
          period,
          rawMin: band.min,
          rawMax: band.max,
          rawPoint: null,
          payBasis: band.basis,
          sourceUrl: detail.jobPostingInfo?.externalUrl ?? `https://${board.tenant}.${board.dataCenter}.myworkdayjobs.com${posting.externalPath}`,
          fetchedAt: new Date().toISOString(),
          sampleSize: 1,
          // Period-scoped — see the comment on the equivalent line in
          // adapters/adzuna.ts for why.
          observationKey: `ats:workday:${period}:${board.tenant}:${posting.externalPath}`,
        })
      }
    }

    ctx.log('ats-workday.fetchObservations', { jobId: job.id, cityId: city.id, period, rows: observations.length })
    return observations
  },
}
