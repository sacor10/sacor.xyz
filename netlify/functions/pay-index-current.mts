// GET /api/index/current (redirected from /.netlify/functions/pay-index-current)
//
// Methodology rule 6: every published number is returned in the SAME
// payload as its basket version, methodology version, formula text, and
// coverage counts — there is no way for a client to render the headline
// mean without also having what it needs to render the rest.

import { getPayIndexDb } from './_lib/payindex/db.ts'
import { json, methodNotAllowed, serverError } from './_lib/payindex/respond.ts'
import { getLatestSnapshot, getBaselinePeriod, getCityBreakdown, getCoverageBreakdown, getAttributionSources } from './_lib/payindex/repo.ts'
import { BASKET_VERSION, METHODOLOGY_VERSION, FORMULA_TEXT, MIN_OBSERVATIONS, ANNUALIZATION_HOURS } from '../../src/data/payIndex/basket.ts'

function formatPct(x: number): string {
  const pct = (x * 100).toFixed(2)
  return `${x >= 0 ? '+' : ''}${pct}%`
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return methodNotAllowed()

  try {
    const db = await getPayIndexDb()
    const snapshot = await getLatestSnapshot(db)

    if (!snapshot) {
      const baselinePeriod = await getBaselinePeriod(db)
      return json({
        status: 'baseline_only',
        baselinePeriod,
        basketVersion: BASKET_VERSION,
        methodologyVersion: METHODOLOGY_VERSION,
        formula: FORMULA_TEXT,
        message: baselinePeriod
          ? `Baseline period ${baselinePeriod} established. The change figure publishes once a later period is ingested.`
          : 'No data has been ingested yet.',
      })
    }

    const [cityBreakdown, coverage, attributions] = await Promise.all([
      getCityBreakdown(db, snapshot.period, snapshot.baselinePeriod),
      getCoverageBreakdown(db, snapshot.period),
      getAttributionSources(db),
    ])

    const pctCovered = snapshot.cellsTotal === 0 ? 0 : snapshot.cellsIncluded / snapshot.cellsTotal
    const gapReasons = Object.fromEntries(coverage.filter((c) => c.status !== 'included').map((c) => [c.status, c.count]))

    return json({
      status: 'ok',
      period: snapshot.period,
      baselinePeriod: snapshot.baselinePeriod,
      headline: { metric: 'mean', pctChange: snapshot.indexMean, display: formatPct(snapshot.indexMean) },
      mean: snapshot.indexMean,
      median: snapshot.indexMedian,
      coverage: {
        cellsTotal: snapshot.cellsTotal,
        cellsIncluded: snapshot.cellsIncluded,
        cellsMissing: snapshot.cellsMissing,
        pctCovered,
        gapReasons,
      },
      basketVersion: snapshot.basketVersion,
      methodologyVersion: snapshot.methodologyVersion,
      formula: FORMULA_TEXT,
      minObservations: MIN_OBSERVATIONS,
      annualizationHours: ANNUALIZATION_HOURS,
      computedAt: snapshot.computedAt,
      cityBreakdown,
      attributions,
    })
  } catch (err) {
    return serverError(err)
  }
}
