// Observations -> cell_values. This is where methodology rules 4 and 7
// become code:
//
//   rule 4 (no silent gaps) — a cell with fewer than MIN_OBSERVATIONS
//   eligible observations is returned as an explicit gap, never a value.
//   There is no code path here that interpolates, carries forward, or
//   substitutes a similar title: the function only ever looks at the
//   observations it was given for this exact (job, city, period).
//
//   rule 7 (never average an already-averaged figure) — only observations
//   from a 'posting' or 'scale' source are pooled into the median.
//   'aggregate' sources (e.g. Levels.fyi, whose figures are already
//   per-level medians) are filtered out before the median is computed.

import { MIN_OBSERVATIONS } from '../../../../src/data/payIndex/basket.ts'
import type { CellStatus, CellValue, NormalizedObservation } from './types.ts'

export type CellOutcome =
  | { readonly kind: 'cell'; readonly value: CellValue }
  | {
      readonly kind: 'gap'
      readonly jobId: string
      readonly cityId: string
      readonly period: string
      readonly reason: Exclude<CellStatus, 'included'>
      readonly observationCount: number
    }

function median(sortedAscending: readonly number[]): number {
  const n = sortedAscending.length
  const mid = Math.floor(n / 2)
  return n % 2 === 0 ? (sortedAscending[mid - 1] + sortedAscending[mid]) / 2 : sortedAscending[mid]
}

export interface BuildCellValueArgs {
  readonly jobId: string
  readonly cityId: string
  readonly period: string
  // Caller (the repository layer) is responsible for only passing
  // observations for this exact (job, city, period) that are not
  // superseded/voided — this function trusts its input and does not
  // re-query anything, keeping it pure and cheaply testable.
  readonly observations: readonly NormalizedObservation[]
}

export function buildCellValue(args: BuildCellValueArgs): CellOutcome {
  const { jobId, cityId, period, observations } = args

  // Rule 7: pooled raw observations only. Already-averaged figures never
  // enter the pool, so there is no path from an 'aggregate' source to a
  // cell median — not even diluted in with real observations.
  const eligible = observations.filter((o) => o.sourceKind === 'posting' || o.sourceKind === 'scale')
  const n = eligible.length

  if (n === 0) {
    return { kind: 'gap', jobId, cityId, period, reason: 'gap_no_data', observationCount: 0 }
  }
  if (n < MIN_OBSERVATIONS) {
    return { kind: 'gap', jobId, cityId, period, reason: 'gap_below_threshold', observationCount: n }
  }

  const points = eligible.map((o) => o.annualPoint).sort((a, b) => a - b)
  const medianAnnualPay = median(points)
  const sourceIds = Array.from(new Set(eligible.map((o) => o.sourceId))).sort()

  return {
    kind: 'cell',
    value: {
      jobId,
      cityId,
      period,
      status: 'included',
      medianAnnualPay,
      observationCount: n,
      sourceIds,
    },
  }
}
