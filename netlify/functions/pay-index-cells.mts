// GET /api/cells?period=&city=&job= (redirected from /.netlify/functions/pay-index-cells)
//
// The full transparency table: every cell for a period, INCLUDING gaps —
// methodology rule 4 says a gap is a row, never an omission, so this
// endpoint never filters gap rows out by default.

import { getPayIndexDb } from './_lib/payindex/db.ts'
import { json, methodNotAllowed, serverError } from './_lib/payindex/respond.ts'
import { getCellsForPeriod, getLatestSnapshot } from './_lib/payindex/repo.ts'
import { jobs } from '../../src/data/payIndex/jobs.ts'
import { cities } from '../../src/data/payIndex/cities.ts'

const jobById = new Map(jobs.map((j) => [j.id, j]))
const cityById = new Map(cities.map((c) => [c.id, c]))

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return methodNotAllowed()

  try {
    const url = new URL(req.url)
    const cityId = url.searchParams.get('city') ?? undefined
    const jobId = url.searchParams.get('job') ?? undefined

    const db = await getPayIndexDb()
    let period = url.searchParams.get('period')
    if (!period) {
      const latest = await getLatestSnapshot(db)
      period = latest?.period ?? null
    }
    if (!period) return json({ period: null, cells: [] })

    const cells = await getCellsForPeriod(db, period, cityId, jobId)
    return json({
      period,
      cells: cells.map((c) => ({
        jobId: c.jobId,
        job: jobById.get(c.jobId)?.title ?? c.jobId,
        cityId: c.cityId,
        city: cityById.get(c.cityId)?.name ?? c.cityId,
        status: c.status,
        medianAnnualPay: c.medianAnnualPay,
        observationCount: c.observationCount,
        sourceIds: c.sourceIds,
      })),
    })
  } catch (err) {
    return serverError(err)
  }
}
