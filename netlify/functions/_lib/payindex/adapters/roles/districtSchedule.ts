// Tier C: negotiated teacher salary schedules, sourced from the local
// teachers association/union's published copy — deliberately NOT the school
// district's own site, since a public school district is a government body
// and methodology rule 9 excludes government data outright.
//
// Same "each step is its own observation" shape as unionScale.ts: a salary
// schedule is a table of steps/lanes, and this stores the schedule as
// published rather than collapsing it into one number before it's even in
// the database.

import type { Job, City } from '../../../../../../src/data/payIndex/types.ts'
import { districtScheduleEntries } from '../../../../../../src/data/payIndex/roleSources.ts'
import type { Observation } from '../../types.ts'
import type { SourceAdapter, AdapterContext } from '../index.ts'
import { parseSingleRate } from './parseRate.ts'
import { extractTableRows } from './tableRows.ts'

export const districtScheduleAdapter: SourceAdapter = {
  id: 'district-salary-schedule',
  tier: 'C',
  sourceIds: ['district-salary-schedule'],

  async preflight() {
    // Public pages, no credentials required.
  },

  covers(job: Job, city: City): boolean {
    return districtScheduleEntries.some((e) => e.jobId === job.id && e.cityId === city.id)
  },

  async fetchObservations(job: Job, city: City, period: string, ctx: AdapterContext): Promise<Observation[]> {
    const entries = districtScheduleEntries.filter((e) => e.jobId === job.id && e.cityId === city.id)
    const observations: Observation[] = []

    for (const entry of entries) {
      let html: string
      try {
        html = await ctx.http.fetchText(entry.url)
      } catch (err) {
        ctx.log('district-salary-schedule.fetch_failed', { entry: entry.id, url: entry.url, error: String(err) })
        continue
      }

      const rows = extractTableRows(html)
      let step = 0
      for (const rowText of rows) {
        // Salary schedules are conventionally annual figures.
        const rate = parseSingleRate(rowText, 'annual')
        if (!rate) continue
        step += 1

        observations.push({
          sourceId: 'district-salary-schedule',
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
          observationKey: `district-schedule:${period}:${entry.id}:${step}`,
        })
      }
    }

    ctx.log('district-salary-schedule.fetchObservations', { jobId: job.id, cityId: city.id, period, rows: observations.length })
    return observations
  },
}
