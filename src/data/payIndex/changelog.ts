// The Pay Index basket changelog. This is the ONLY place basket changes are
// allowed to happen — every add/remove of a job or city must be paired with
// a dated entry here and a bump to BASKET_VERSION (basket.ts). Never edit or
// delete a past entry; append a new one.

import type { ChangelogEntry } from './types'
import { BASKET_VERSION, METHODOLOGY_VERSION, BASKET_EFFECTIVE_DATE } from './basket'

export const changelog: ChangelogEntry[] = [
  {
    effectiveDate: BASKET_EFFECTIVE_DATE,
    basketVersion: BASKET_VERSION,
    methodologyVersion: METHODOLOGY_VERSION,
    changeType: 'basket_created',
    detail:
      'Initial Pay Index basket: 60 job titles across 12 occupational categories x 25 U.S. metros = 1,500 cells. ' +
      'This period is the baseline — no change figure publishes until a second period is ingested.',
  },
]
