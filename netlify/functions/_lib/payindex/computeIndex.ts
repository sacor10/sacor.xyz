// The headline calculation. Pure — no I/O, no clock, no environment reads —
// so the same input always produces byte-identical output; this is what
// makes a published number reproducible from its stored inputs (rule 5).
//
// Methodology rule 3 (simple unweighted mean) is enforced by what this file
// does NOT contain: there is no weight field anywhere in the input or
// output types, and computeIndex takes exactly one argument. Weighting by
// employment share, population, or posting volume isn't disabled — it has
// nowhere to be expressed. See computeIndex.test.ts for a fixture where a
// population-weighted mean would give a materially different (and wrong,
// per this index's own rules) answer.
//
// Methodology rule 4 (no silent gaps) is enforced structurally: the loop
// below is driven by `basketCells` — every active (job, city) pair in the
// fixed basket — not by whatever data happens to exist. A cell that isn't
// includable is pushed onto `missingCells` with its real reason; it can
// never just be absent from both lists, which the included+missing===total
// invariant checks explicitly.

import type { CellChange, CellStatus, CellValue, IndexResult } from './types.ts'

export function cellKey(jobId: string, cityId: string): string {
  return `${jobId}::${cityId}`
}

export interface BasketCellRef {
  readonly jobId: string
  readonly cityId: string
}

export interface ComputeIndexInput {
  readonly period: string
  readonly baselinePeriod: string
  // Every active (job, city) pair in the basket for this computation — the
  // authoritative list the loop is driven by, not the data.
  readonly basketCells: readonly BasketCellRef[]
  readonly currentCells: ReadonlyMap<string, CellValue>
  readonly baselineCells: ReadonlyMap<string, CellValue>
}

function median(sortedAscending: readonly number[]): number {
  const n = sortedAscending.length
  if (n === 0) return 0
  const mid = Math.floor(n / 2)
  return n % 2 === 0 ? (sortedAscending[mid - 1] + sortedAscending[mid]) / 2 : sortedAscending[mid]
}

function includedValue(cell: CellValue | undefined): number | null {
  if (!cell || cell.status !== 'included' || cell.medianAnnualPay === null) return null
  return cell.medianAnnualPay
}

export function computeIndex(input: ComputeIndexInput): IndexResult {
  const { period, baselinePeriod, basketCells, currentCells, baselineCells } = input

  const changes: CellChange[] = []
  const missingCells: { jobId: string; cityId: string; reason: CellStatus }[] = []

  for (const { jobId, cityId } of basketCells) {
    const key = cellKey(jobId, cityId)
    const current = currentCells.get(key)
    const baseline = baselineCells.get(key)

    const currentValue = includedValue(current)
    if (currentValue === null) {
      missingCells.push({ jobId, cityId, reason: current?.status ?? 'gap_no_data' })
      continue
    }

    const baselineValue = includedValue(baseline)
    if (baselineValue === null) {
      missingCells.push({ jobId, cityId, reason: baseline?.status ?? 'gap_no_data' })
      continue
    }

    if (baselineValue <= 0) {
      throw new Error(`Invalid baseline for ${jobId}/${cityId}: medianAnnualPay must be > 0, got ${baselineValue}`)
    }

    changes.push({
      jobId,
      cityId,
      baselineAnnualPay: baselineValue,
      currentAnnualPay: currentValue,
      pctChange: (currentValue - baselineValue) / baselineValue,
    })
  }

  const cellsTotal = basketCells.length
  const cellsIncluded = changes.length
  const cellsMissing = missingCells.length

  // Rule 4 as an executable invariant: a cell can never be neither included
  // nor accounted for as missing.
  if (cellsIncluded + cellsMissing !== cellsTotal) {
    throw new Error(
      `Invariant violated: cellsIncluded (${cellsIncluded}) + cellsMissing (${cellsMissing}) !== cellsTotal (${cellsTotal})`,
    )
  }

  // Deterministic order so a recomputation from the same stored
  // observations is byte-identical.
  changes.sort((a, b) => (a.jobId === b.jobId ? a.cityId.localeCompare(b.cityId) : a.jobId.localeCompare(b.jobId)))
  missingCells.sort((a, b) => (a.jobId === b.jobId ? a.cityId.localeCompare(b.cityId) : a.jobId.localeCompare(b.jobId)))

  // The headline: a simple arithmetic mean of every cell's % change. No
  // weighting parameter exists to divide by anything other than the count
  // of included cells.
  const mean = cellsIncluded === 0 ? 0 : changes.reduce((sum, c) => sum + c.pctChange, 0) / cellsIncluded
  const sortedChanges = changes.map((c) => c.pctChange).sort((a, b) => a - b)
  const medianChange = median(sortedChanges)

  return {
    period,
    baselinePeriod,
    mean,
    median: medianChange,
    cellsIncluded,
    cellsMissing,
    cellsTotal,
    changes,
    missingCells,
  }
}
