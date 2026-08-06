// Methodology rule 2: no adjustment, ever. Normalization here means ONE
// thing — converting an hourly rate to an annual one on a fixed, published
// constant (2080 hours/year) — and nothing else. The raw value is never
// replaced; callers store rawMin/rawMax/rawPoint alongside the normalized
// annualPoint (see schema.ts's pay_index_observations table).
//
// The function signature is the enforcement: it takes only the raw pay
// figure and its basis. There is no period argument, no price-level/CPI
// argument, no "as of" date — inflation adjustment is structurally
// unrepresentable here, not just avoided by convention.

import { ANNUALIZATION_HOURS } from '../../../../src/data/payIndex/basket.ts'
import type { PayBasis } from './types.ts'

export interface RawPay {
  readonly rawMin: number | null
  readonly rawMax: number | null
  readonly rawPoint: number | null
  readonly payBasis: PayBasis
}

export interface NormalizedPay {
  readonly annualPoint: number
}

function midpoint(min: number | null, max: number | null): number | null {
  if (min === null || max === null) return null
  return (min + max) / 2
}

// Exactly one parameter: the raw figure. No second argument for a period,
// deflator, or adjustment factor can be added without changing this
// signature — which is exactly what tests/payindex/normalize.test.ts pins.
export function normalizeToAnnual(raw: RawPay): NormalizedPay {
  const point = raw.rawPoint ?? midpoint(raw.rawMin, raw.rawMax)
  if (point === null) {
    throw new Error('Cannot normalize pay: no rawPoint and no rawMin/rawMax pair to derive a midpoint from')
  }
  const multiplier = raw.payBasis === 'hourly' ? ANNUALIZATION_HOURS : 1
  return { annualPoint: point * multiplier }
}
