// Tier B, platform 2 of 4: Lever. Public per-employer postings JSON API.
// Prefers Lever's own structured `salaryRange` field when a posting has
// one (cleaner than parsing text); falls back to parsePayBand on the plain
// description otherwise.

import type { Job, City } from '../../../../../../src/data/payIndex/types.ts'
import { leverBoards } from '../../../../../../src/data/payIndex/atsBoards.ts'
import type { Observation } from '../../types.ts'
import type { SourceAdapter, AdapterContext } from '../index.ts'
import { matchesJob, matchesCity } from '../../matching.ts'
import { parsePayBand, type ParsedBand } from './parseBand.ts'

interface LeverSalaryRange {
  readonly min?: number
  readonly max?: number
  readonly interval?: string
}

interface LeverPosting {
  readonly id: string
  readonly text?: string
  readonly hostedUrl: string
  readonly categories?: { readonly location?: string }
  readonly salaryRange?: LeverSalaryRange
  readonly descriptionPlain?: string
}

function bandFromPosting(posting: LeverPosting): ParsedBand | null {
  const range = posting.salaryRange
  if (range && typeof range.min === 'number' && typeof range.max === 'number' && range.max >= range.min && range.min > 0) {
    const basis = /hour/i.test(range.interval ?? '') ? 'hourly' : 'annual'
    return { min: range.min, max: range.max, basis }
  }
  return parsePayBand(posting.descriptionPlain ?? '')
}

export const leverAdapter: SourceAdapter = {
  id: 'ats-lever',
  tier: 'B',
  sourceIds: ['ats-lever'],

  async preflight() {
    // Public API, no credentials required.
  },

  covers() {
    return leverBoards.length > 0
  },

  async fetchObservations(job: Job, city: City, period: string, ctx: AdapterContext): Promise<Observation[]> {
    const observations: Observation[] = []

    for (const board of leverBoards) {
      const url = `https://api.lever.co/v0/postings/${board.token}?mode=json`
      let postings: LeverPosting[]
      try {
        postings = await ctx.http.fetchJson<LeverPosting[]>(url)
      } catch (err) {
        ctx.log('ats-lever.board_fetch_failed', { employer: board.employer, token: board.token, error: String(err) })
        continue
      }

      for (const posting of postings ?? []) {
        const title = posting.text ?? ''
        const location = posting.categories?.location ?? ''
        if (!matchesJob(title, job)) continue
        if (!matchesCity(location, city)) continue

        const band = bandFromPosting(posting)
        if (!band) continue

        observations.push({
          sourceId: 'ats-lever',
          sourceKind: 'posting',
          jobId: job.id,
          cityId: city.id,
          period,
          rawMin: band.min,
          rawMax: band.max,
          rawPoint: null,
          payBasis: band.basis,
          sourceUrl: posting.hostedUrl,
          fetchedAt: new Date().toISOString(),
          sampleSize: 1,
          // Period-scoped — see the comment on the equivalent line in
          // adapters/adzuna.ts for why.
          observationKey: `ats:lever:${period}:${board.token}:${posting.id}`,
        })
      }
    }

    ctx.log('ats-lever.fetchObservations', { jobId: job.id, cityId: city.id, period, rows: observations.length })
    return observations
  },
}
