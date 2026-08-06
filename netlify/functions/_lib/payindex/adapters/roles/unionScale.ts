// Tier C: published union local wage scales (IBEW, UA, and similar building
// trades locals). Config-driven from unionScaleEntries — adding a local is
// a registry row (src/data/payIndex/roleSources.ts), not new code.
//
// Each row of the published scale (step, classification) becomes its own
// observation — this index doesn't collapse a scale into one figure before
// storing it, so aggregate.ts's median-of-observations still means
// something for a trades cell. A page that doesn't parse contributes zero
// rows for that entry (an honest gap, logged), never a fabricated rate.

import type { Job, City } from '../../../../../../src/data/payIndex/types.ts'
import { unionScaleEntries } from '../../../../../../src/data/payIndex/roleSources.ts'
import type { Observation } from '../../types.ts'
import type { SourceAdapter, AdapterContext } from '../index.ts'
import { parseSingleRate } from './parseRate.ts'
import { extractTableRows } from './tableRows.ts'

export const unionScaleAdapter: SourceAdapter = {
  id: 'union-wage-scale',
  tier: 'C',
  sourceIds: ['union-wage-scale'],

  async preflight() {
    // Public pages, no credentials required.
  },

  covers(job: Job, city: City): boolean {
    return unionScaleEntries.some((e) => e.jobId === job.id && e.cityId === city.id)
  },

  async fetchObservations(job: Job, city: City, period: string, ctx: AdapterContext): Promise<Observation[]> {
    const entries = unionScaleEntries.filter((e) => e.jobId === job.id && e.cityId === city.id)
    const observations: Observation[] = []

    for (const entry of entries) {
      let html: string
      try {
        html = await ctx.http.fetchText(entry.url)
      } catch (err) {
        ctx.log('union-wage-scale.fetch_failed', { entry: entry.id, url: entry.url, error: String(err) })
        continue
      }

      const rows = extractTableRows(html)
      let step = 0
      for (const rowText of rows) {
        // Union trades scales are conventionally hourly rates.
        const rate = parseSingleRate(rowText, 'hourly')
        if (!rate) continue
        step += 1

        observations.push({
          sourceId: 'union-wage-scale',
          sourceKind: 'scale',
          jobId: job.id,
          cityId: city.id,
          period,
          rawMin: null,
          rawMax: null,
          rawPoint: rate.value,
          payBasis: rate.basis,
          sourceUrl: entry.url,
          fetchedAt: new Date().toISOString(),
          sampleSize: null,
          observationKey: `union-scale:${period}:${entry.id}:${step}`,
        })
      }
    }

    ctx.log('union-wage-scale.fetchObservations', { jobId: job.id, cityId: city.id, period, rows: observations.length })
    return observations
  },
}
