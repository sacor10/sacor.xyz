// Server-side Pay Index shapes: the DB-facing types shared by the ingest
// pipeline (aggregate.ts, computeIndex.ts, adapters) and the read functions.
// See src/data/payIndex/types.ts for the basket-config shapes (Job, City,
// Source) — those are config, these are pipeline data.

export type PayBasis = 'hourly' | 'annual'

// A single raw pay data point as an adapter reports it — never adjusted,
// never averaged by the adapter. sourceKind determines whether this
// observation can ever reach a cell median (aggregate.ts only pools
// 'posting' and 'scale' kinds — see methodology rule 7 in PLAN.md).
export interface Observation {
  readonly sourceId: string
  readonly sourceKind: 'posting' | 'scale' | 'aggregate'
  readonly jobId: string
  readonly cityId: string
  readonly period: string // 'YYYY-MM'
  readonly rawMin: number | null
  readonly rawMax: number | null
  readonly rawPoint: number | null
  readonly payBasis: PayBasis
  readonly sourceUrl: string
  readonly fetchedAt: string
  readonly sampleSize: number | null
  // Stable per underlying posting/row so a retried/resumed ingest run can't
  // double-count it. E.g. 'adzuna:123456', 'ats:greenhouse:stripe:789'.
  readonly observationKey: string
  readonly transcribed?: boolean
}

// An Observation as stored (has a DB id) plus its normalized annual figure.
// Aggregation only ever reads annualPoint — it never re-derives it from raw
// values, so normalization logic lives in exactly one place (normalize.ts).
export interface NormalizedObservation extends Observation {
  readonly id: number
  readonly annualPoint: number
}

export type CellStatus = 'included' | 'gap_no_data' | 'gap_below_threshold'

export interface CellValue {
  readonly jobId: string
  readonly cityId: string
  readonly period: string
  readonly status: CellStatus
  // Always on the common annual basis; null when status !== 'included'.
  readonly medianAnnualPay: number | null
  readonly observationCount: number
  readonly sourceIds: readonly string[]
}

export interface CellChange {
  readonly jobId: string
  readonly cityId: string
  readonly baselineAnnualPay: number
  readonly currentAnnualPay: number
  readonly pctChange: number
}

export interface IndexResult {
  readonly period: string
  readonly baselinePeriod: string
  readonly mean: number
  readonly median: number
  readonly cellsIncluded: number
  readonly cellsMissing: number
  readonly cellsTotal: number
  readonly changes: readonly CellChange[]
  readonly missingCells: readonly { jobId: string; cityId: string; reason: CellStatus }[]
}

export type AdapterRunStatus = 'ok' | 'zero_rows' | 'error'

export interface AdapterRunResult {
  readonly adapterId: string
  readonly period: string
  readonly rowsReturned: number
  readonly status: AdapterRunStatus
  readonly error: string | null
}
