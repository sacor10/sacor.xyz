// Tier A: Adzuna — the backbone. Free developer API, broad occupational
// coverage, not tech-skewed. One observation per posting; the cell value is
// the median of posting midpoints, computed downstream in aggregate.ts.

import type { Job, City } from '../../../../../src/data/payIndex/types.ts'
import type { Observation } from '../types.ts'
import type { SourceAdapter, AdapterContext } from './index.ts'
import { matchesJob, matchesCity } from '../matching.ts'
import { PayIndexError } from '../errors.ts'

const RESULTS_PER_PAGE = 50
const MAX_PAGES = 2
const MAX_DAYS_OLD = 45

interface AdzunaResult {
  readonly id: string
  readonly title: string
  readonly salary_min?: number
  readonly salary_max?: number
  readonly salary_is_predicted?: string
  readonly redirect_url: string
  readonly created?: string
  readonly location?: { readonly display_name?: string }
}

interface AdzunaSearchResponse {
  readonly count: number
  readonly results: readonly AdzunaResult[]
}

function getCredentials(): { appId: string; appKey: string } {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) {
    throw new PayIndexError(
      'adzuna_credentials_missing',
      'Adzuna credentials missing: set ADZUNA_APP_ID and ADZUNA_APP_KEY (see .env.example). ' +
        'Refusing to run — a credential-less run would produce zero rows that look like a legitimate coverage gap.',
      500,
    )
  }
  return { appId, appKey }
}

function searchUrl(page: number, appId: string, appKey: string, job: Job, city: City): string {
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what_phrase: job.canonicalKeywords[0],
    where: city.adzunaLocation,
    results_per_page: String(RESULTS_PER_PAGE),
    max_days_old: String(MAX_DAYS_OLD),
    'content-type': 'application/json',
  })
  return `https://api.adzuna.com/v1/api/jobs/us/search/${page}?${params.toString()}`
}

export const adzunaAdapter: SourceAdapter = {
  id: 'adzuna',
  tier: 'A',
  sourceIds: ['adzuna'],

  async preflight() {
    getCredentials()
  },

  covers() {
    // The backbone: Adzuna's search covers every basket cell in principle.
    // Whether it actually returns anything is a per-request outcome, not a
    // config-time decision.
    return true
  },

  async fetchObservations(job: Job, city: City, period: string, ctx: AdapterContext): Promise<Observation[]> {
    const { appId, appKey } = getCredentials()
    const observations: Observation[] = []

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = searchUrl(page, appId, appKey, job, city)
      const response = await ctx.http.fetchJson<AdzunaSearchResponse>(url)

      if (!response.results || response.results.length === 0) break

      for (const result of response.results) {
        // Rule 7: never average an already-averaged/imputed figure into the
        // headline. salary_is_predicted='1' is Adzuna's own model output for
        // postings that didn't disclose a real figure — drop it, it's not a
        // raw observation no matter how the API packages it.
        if (result.salary_is_predicted === '1') continue
        if (typeof result.salary_min !== 'number' || typeof result.salary_max !== 'number') continue
        if (result.salary_min <= 0 || result.salary_max < result.salary_min) continue

        const title = result.title ?? ''
        const location = result.location?.display_name ?? ''
        if (!matchesJob(title, job)) continue
        if (!matchesCity(location, city)) continue

        observations.push({
          sourceId: 'adzuna',
          sourceKind: 'posting',
          jobId: job.id,
          cityId: city.id,
          period,
          rawMin: result.salary_min,
          rawMax: result.salary_max,
          rawPoint: null,
          // Adzuna normalizes US salary figures to an annual basis.
          payBasis: 'annual',
          sourceUrl: result.redirect_url,
          fetchedAt: new Date().toISOString(),
          sampleSize: 1,
          observationKey: `adzuna:${result.id}`,
        })
      }

      if (response.results.length < RESULTS_PER_PAGE) break
    }

    ctx.log('adzuna.fetchObservations', { jobId: job.id, cityId: city.id, period, rows: observations.length })
    return observations
  },
}
