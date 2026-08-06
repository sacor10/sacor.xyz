// GET /api/basket (redirected from /.netlify/functions/pay-index-basket)
// The fixed basket, the source registry, and the changelog — static config,
// no DB round trip needed. This is the page's "what exactly is being
// measured" answer, published alongside the headline per methodology rule 6.

import { json, methodNotAllowed } from './_lib/payindex/respond.ts'
import { jobs } from '../../src/data/payIndex/jobs.ts'
import { cities } from '../../src/data/payIndex/cities.ts'
import { sources } from '../../src/data/payIndex/sources.ts'
import { changelog } from '../../src/data/payIndex/changelog.ts'
import {
  BASKET_VERSION,
  METHODOLOGY_VERSION,
  FORMULA_TEXT,
  MIN_OBSERVATIONS,
  ANNUALIZATION_HOURS,
} from '../../src/data/payIndex/basket.ts'

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return methodNotAllowed()

  return json({
    basketVersion: BASKET_VERSION,
    methodologyVersion: METHODOLOGY_VERSION,
    formula: FORMULA_TEXT,
    minObservations: MIN_OBSERVATIONS,
    annualizationHours: ANNUALIZATION_HOURS,
    jobs: jobs
      .filter((j) => j.active)
      .map((j) => ({ id: j.id, title: j.title, category: j.category })),
    cities: cities
      .filter((c) => c.active)
      .map((c) => ({ id: c.id, name: c.name, region: c.region })),
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      tier: s.tier,
      licenseNote: s.licenseNote,
      attributionRequired: s.attributionRequired,
      attributionText: s.attributionText,
      homepageUrl: s.homepageUrl,
    })),
    changelog,
  })
}
