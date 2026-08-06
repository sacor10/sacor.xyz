// GET /api/coverage?period= (redirected from /.netlify/functions/pay-index-coverage)
//
// Coverage stats and per-adapter health, published so the index can't
// quietly degrade (rule 8: a source going silently dark is an alert, not a
// no-op — this is where that alert surfaces to the page).

import { getPayIndexDb } from './_lib/payindex/db.ts'
import { json, methodNotAllowed, serverError } from './_lib/payindex/respond.ts'
import { getLatestSnapshot, getCoverageBreakdown, getAdapterHealth } from './_lib/payindex/repo.ts'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return methodNotAllowed()

  try {
    const db = await getPayIndexDb()
    const url = new URL(req.url)
    let period = url.searchParams.get('period')
    if (!period) {
      const latest = await getLatestSnapshot(db)
      period = latest?.period ?? null
    }
    if (!period) return json({ period: null, coverage: [], adapterHealth: [], brokenAdapters: [], stale: true })

    const [coverage, adapterHealth] = await Promise.all([getCoverageBreakdown(db, period), getAdapterHealth(db, period)])
    const brokenAdapters = adapterHealth.filter((a) => a.status === 'zero_rows' || a.status === 'error').map((a) => a.adapterId)

    return json({
      period,
      coverage,
      adapterHealth,
      brokenAdapters,
      stale: brokenAdapters.length > 0,
    })
  } catch (err) {
    return serverError(err)
  }
}
