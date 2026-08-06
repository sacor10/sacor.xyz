// Tier C: Vivian Health per-contract nursing pay listings. Vivian's search
// results aren't behind a documented public API, so this adapter targets a
// generic, defensively-parsed JSON shape (an array of listings with a pay
// figure and a location string) rather than assuming exact field names.
// This is the adapter most likely to need re-verification against Vivian's
// actual current response shape before it produces real rows — that's
// expected to surface as a zero-rows alert (rule 8) if the assumed shape is
// wrong, not as silently-fabricated data.

import type { Job, City } from '../../../../../../src/data/payIndex/types.ts'
import { vivianEntries } from '../../../../../../src/data/payIndex/roleSources.ts'
import type { Observation } from '../../types.ts'
import type { SourceAdapter, AdapterContext } from '../index.ts'
import { matchesCity } from '../../matching.ts'

interface VivianListing {
  readonly id?: string | number
  readonly url?: string
  readonly location?: string
  readonly city?: string
  readonly state?: string
  // Weekly gross pay is Vivian's standard travel-nursing figure; a plain
  // hourly rate is also accepted when present instead.
  readonly weeklyPay?: number
  readonly hourlyRate?: number
}

interface VivianSearchResponse {
  readonly results?: readonly VivianListing[]
  readonly jobs?: readonly VivianListing[]
  readonly listings?: readonly VivianListing[]
}

function listingsFrom(response: VivianSearchResponse): readonly VivianListing[] {
  return response.results ?? response.jobs ?? response.listings ?? []
}

function locationTextOf(listing: VivianListing): string {
  if (listing.location) return listing.location
  return [listing.city, listing.state].filter(Boolean).join(', ')
}

const WEEKS_PER_YEAR = 52

export const vivianAdapter: SourceAdapter = {
  id: 'vivian-health',
  tier: 'C',
  sourceIds: ['vivian-health'],

  async preflight() {
    // Public search, no credentials required.
  },

  covers(job: Job): boolean {
    return vivianEntries.some((e) => e.jobId === job.id)
  },

  async fetchObservations(job: Job, city: City, period: string, ctx: AdapterContext): Promise<Observation[]> {
    const entries = vivianEntries.filter((e) => e.jobId === job.id)
    const observations: Observation[] = []

    for (const entry of entries) {
      let response: VivianSearchResponse
      try {
        response = await ctx.http.fetchJson<VivianSearchResponse>(entry.searchUrl)
      } catch (err) {
        ctx.log('vivian-health.fetch_failed', { entry: entry.id, url: entry.searchUrl, error: String(err) })
        continue
      }

      for (const listing of listingsFrom(response)) {
        if (!matchesCity(locationTextOf(listing), city)) continue

        let rawPoint: number | null = null
        let payBasis: 'hourly' | 'annual' = 'annual'
        if (typeof listing.hourlyRate === 'number' && listing.hourlyRate > 0) {
          rawPoint = listing.hourlyRate
          payBasis = 'hourly'
        } else if (typeof listing.weeklyPay === 'number' && listing.weeklyPay > 0) {
          rawPoint = listing.weeklyPay * WEEKS_PER_YEAR
          payBasis = 'annual'
        }
        if (rawPoint === null) continue

        observations.push({
          sourceId: 'vivian-health',
          sourceKind: 'posting',
          jobId: job.id,
          cityId: city.id,
          period,
          rawMin: null,
          rawMax: null,
          rawPoint,
          payBasis,
          sourceUrl: listing.url ?? entry.searchUrl,
          fetchedAt: new Date().toISOString(),
          sampleSize: 1,
          observationKey: `vivian:${period}:${entry.id}:${listing.id ?? locationTextOf(listing)}`,
        })
      }
    }

    ctx.log('vivian-health.fetchObservations', { jobId: job.id, cityId: city.id, period, rows: observations.length })
    return observations
  },
}
