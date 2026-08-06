// Tier C: carrier driver pay pages. These usually advertise a
// national/regional cents-per-mile (CPM) rate, not a per-metro one — this
// index cannot honestly assign a national rate to a specific basket city.
// So this adapter does two conservative things a naive scraper wouldn't:
//
//   1. Strips out any sentence mentioning "per mile"/"cpm"/"cents per
//      mile" before looking for a dollar figure, so a CPM rate is never
//      misread as an annual salary (2.5 misread as $2.50/year is an absurd
//      example of the failure mode this avoids more generally).
//   2. Only emits an observation when the page text names this specific
//      basket city — a page with no named city contributes nothing for any
//      city rather than guessing which terminal it means.

import type { Job, City } from '../../../../../../src/data/payIndex/types.ts'
import { carrierPayEntries } from '../../../../../../src/data/payIndex/roleSources.ts'
import type { Observation } from '../../types.ts'
import type { SourceAdapter, AdapterContext } from '../index.ts'
import { parsePayBand } from '../ats/parseBand.ts'
import { parseSingleRate } from './parseRate.ts'
import { stripHtml } from '../ats/common.ts'
import { matchesCity } from '../../matching.ts'

const MILE_RATE_PATTERN = /[^.]*\b(per\s*mile|cents?\s*per\s*mile|\bcpm\b|\/\s*mile)\b[^.]*\./gi

function withoutMileRateSentences(text: string): string {
  return text.replace(MILE_RATE_PATTERN, ' ')
}

export const carrierPayAdapter: SourceAdapter = {
  id: 'carrier-pay-page',
  tier: 'C',
  sourceIds: ['carrier-pay-page'],

  async preflight() {
    // Public pages, no credentials required.
  },

  covers(job: Job, city: City): boolean {
    return carrierPayEntries.some((e) => e.jobId === job.id)
  },

  async fetchObservations(job: Job, city: City, period: string, ctx: AdapterContext): Promise<Observation[]> {
    const entries = carrierPayEntries.filter((e) => e.jobId === job.id)
    const observations: Observation[] = []

    for (const entry of entries) {
      let html: string
      try {
        html = await ctx.http.fetchText(entry.url)
      } catch (err) {
        ctx.log('carrier-pay-page.fetch_failed', { entry: entry.id, url: entry.url, error: String(err) })
        continue
      }

      const text = stripHtml(html)
      // A national CPM headline with no named terminal city is a gap for
      // every basket city, not a substitute for local data.
      if (!matchesCity(text, city)) continue

      const filtered = withoutMileRateSentences(text)
      const band = parsePayBand(filtered)
      const rate = band ? null : parseSingleRate(filtered, 'annual')
      if (!band && !rate) continue

      observations.push({
        sourceId: 'carrier-pay-page',
        sourceKind: 'posting',
        jobId: job.id,
        cityId: city.id,
        period,
        rawMin: band?.min ?? null,
        rawMax: band?.max ?? null,
        rawPoint: rate?.value ?? null,
        payBasis: band?.basis ?? rate!.basis,
        sourceUrl: entry.url,
        fetchedAt: new Date().toISOString(),
        sampleSize: null,
        observationKey: `carrier-pay:${period}:${entry.id}:${city.id}`,
      })
    }

    ctx.log('carrier-pay-page.fetchObservations', { jobId: job.id, cityId: city.id, period, rows: observations.length })
    return observations
  },
}
