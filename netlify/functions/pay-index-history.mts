// GET /api/index/history (redirected from /.netlify/functions/pay-index-history)
// Every published snapshot, oldest first — the trend line's data source.

import { getPayIndexDb } from './_lib/payindex/db.ts'
import { json, methodNotAllowed, serverError } from './_lib/payindex/respond.ts'
import { getSnapshotHistory } from './_lib/payindex/repo.ts'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return methodNotAllowed()

  try {
    const db = await getPayIndexDb()
    const snapshots = await getSnapshotHistory(db)
    return json({
      snapshots: snapshots.map((s) => ({
        period: s.period,
        baselinePeriod: s.baselinePeriod,
        mean: s.indexMean,
        median: s.indexMedian,
        cellsIncluded: s.cellsIncluded,
        cellsMissing: s.cellsMissing,
        cellsTotal: s.cellsTotal,
        basketVersion: s.basketVersion,
        methodologyVersion: s.methodologyVersion,
        computedAt: s.computedAt,
      })),
    })
  } catch (err) {
    return serverError(err)
  }
}
