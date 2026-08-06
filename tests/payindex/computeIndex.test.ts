import { describe, expect, it } from 'vitest'
import { computeIndex, cellKey } from '../../netlify/functions/_lib/payindex/computeIndex'
import type { CellValue } from '../../netlify/functions/_lib/payindex/types'

function included(jobId: string, cityId: string, period: string, medianAnnualPay: number): CellValue {
  return { jobId, cityId, period, status: 'included', medianAnnualPay, observationCount: 5, sourceIds: ['adzuna'] }
}

function gap(jobId: string, cityId: string, period: string, reason: 'gap_no_data' | 'gap_below_threshold'): CellValue {
  return { jobId, cityId, period, status: reason, medianAnnualPay: null, observationCount: 0, sourceIds: [] }
}

function toMap(cells: CellValue[]): Map<string, CellValue> {
  return new Map(cells.map((c) => [cellKey(c.jobId, c.cityId), c]))
}

describe('computeIndex — hand-computed fixtures', () => {
  it('matches the worked example: changes of +10%, +2%, -4%, +20% -> mean 7%, median 6%', () => {
    const basketCells = [
      { jobId: 'a', cityId: 'x' },
      { jobId: 'b', cityId: 'x' },
      { jobId: 'c', cityId: 'x' },
      { jobId: 'd', cityId: 'x' },
    ]
    const baselineCells = toMap([
      included('a', 'x', '2025-07', 100),
      included('b', 'x', '2025-07', 100),
      included('c', 'x', '2025-07', 100),
      included('d', 'x', '2025-07', 100),
    ])
    const currentCells = toMap([
      included('a', 'x', '2026-07', 110), // +10%
      included('b', 'x', '2026-07', 102), // +2%
      included('c', 'x', '2026-07', 96), // -4%
      included('d', 'x', '2026-07', 120), // +20%
    ])

    const result = computeIndex({ period: '2026-07', baselinePeriod: '2025-07', basketCells, currentCells, baselineCells })

    expect(result.mean).toBeCloseTo(0.07, 10)
    expect(result.median).toBeCloseTo(0.06, 10)
    expect(result.cellsIncluded).toBe(4)
    expect(result.cellsMissing).toBe(0)
    expect(result.cellsTotal).toBe(4)
  })

  it('the weighting trap: an unweighted mean must NOT equal a city-weighted mean', () => {
    // 10 cells in city A all at +1%, 1 cell in city B at +50%.
    const basketCells = [
      ...Array.from({ length: 10 }, (_, i) => ({ jobId: `job-${i}`, cityId: 'city-a' })),
      { jobId: 'job-x', cityId: 'city-b' },
    ]
    const baseline: CellValue[] = [
      ...Array.from({ length: 10 }, (_, i) => included(`job-${i}`, 'city-a', '2025-01', 100)),
      included('job-x', 'city-b', '2025-01', 100),
    ]
    const current: CellValue[] = [
      ...Array.from({ length: 10 }, (_, i) => included(`job-${i}`, 'city-a', '2026-01', 101)), // +1%
      included('job-x', 'city-b', '2026-01', 150), // +50%
    ]

    const result = computeIndex({
      period: '2026-01',
      baselinePeriod: '2025-01',
      basketCells,
      currentCells: toMap(current),
      baselineCells: toMap(baseline),
    })

    // Correct unweighted mean: (10*0.01 + 0.50) / 11
    const expectedUnweightedMean = (10 * 0.01 + 0.5) / 11
    expect(result.mean).toBeCloseTo(expectedUnweightedMean, 10)

    // A population/city-weighted mean (e.g. treating each CITY equally
    // rather than each CELL equally: (0.01 + 0.50) / 2 = 25.5%) would be a
    // materially different, and per this index's rules, WRONG number.
    const wrongCityWeightedMean = (0.01 + 0.5) / 2
    expect(result.mean).not.toBeCloseTo(wrongCityWeightedMean, 2)
  })

  it('excludes gap cells from the calculation and reports them as missing with their real reason', () => {
    const basketCells = [
      { jobId: 'a', cityId: 'x' },
      { jobId: 'b', cityId: 'x' },
      { jobId: 'c', cityId: 'x' },
    ]
    const baselineCells = toMap([
      included('a', 'x', '2025-07', 100),
      included('b', 'x', '2025-07', 100),
      included('c', 'x', '2025-07', 100),
    ])
    const currentCells = toMap([
      included('a', 'x', '2026-07', 110),
      gap('b', 'x', '2026-07', 'gap_below_threshold'),
      // 'c' has no entry at all in currentCells -> also a gap.
    ])

    const result = computeIndex({ period: '2026-07', baselinePeriod: '2025-07', basketCells, currentCells, baselineCells })

    expect(result.cellsIncluded).toBe(1)
    expect(result.cellsMissing).toBe(2)
    expect(result.cellsTotal).toBe(3)
    expect(result.missingCells).toContainEqual({ jobId: 'b', cityId: 'x', reason: 'gap_below_threshold' })
    expect(result.missingCells).toContainEqual({ jobId: 'c', cityId: 'x', reason: 'gap_no_data' })
    // The mean is computed only from the one included cell.
    expect(result.mean).toBeCloseTo(0.1, 10)
  })

  it('reports a missing baseline as a gap even when the current cell is included', () => {
    const basketCells = [{ jobId: 'a', cityId: 'x' }]
    const baselineCells = toMap([gap('a', 'x', '2025-07', 'gap_no_data')])
    const currentCells = toMap([included('a', 'x', '2026-07', 110)])

    const result = computeIndex({ period: '2026-07', baselinePeriod: '2025-07', basketCells, currentCells, baselineCells })

    expect(result.cellsIncluded).toBe(0)
    expect(result.cellsMissing).toBe(1)
    expect(result.missingCells).toEqual([{ jobId: 'a', cityId: 'x', reason: 'gap_no_data' }])
  })

  it('ignores off-basket cell data present in the maps but absent from basketCells', () => {
    const basketCells = [{ jobId: 'a', cityId: 'x' }]
    const baselineCells = toMap([included('a', 'x', '2025-07', 100), included('off-basket', 'y', '2025-07', 999)])
    const currentCells = toMap([included('a', 'x', '2026-07', 110), included('off-basket', 'y', '2026-07', 999999)])

    const result = computeIndex({ period: '2026-07', baselinePeriod: '2025-07', basketCells, currentCells, baselineCells })

    expect(result.cellsTotal).toBe(1)
    expect(result.changes).toEqual([{ jobId: 'a', cityId: 'x', baselineAnnualPay: 100, currentAnnualPay: 110, pctChange: 0.1 }])
  })

  it('throws on a zero or negative baseline rather than dividing by it', () => {
    const basketCells = [{ jobId: 'a', cityId: 'x' }]
    const baselineCells = toMap([included('a', 'x', '2025-07', 0)])
    const currentCells = toMap([included('a', 'x', '2026-07', 110)])
    expect(() =>
      computeIndex({ period: '2026-07', baselinePeriod: '2025-07', basketCells, currentCells, baselineCells }),
    ).toThrow()
  })

  it('produces a deterministic change order regardless of basket iteration order', () => {
    const basketCells = [
      { jobId: 'zeta', cityId: 'x' },
      { jobId: 'alpha', cityId: 'x' },
    ]
    const baselineCells = toMap([included('zeta', 'x', '2025-07', 100), included('alpha', 'x', '2025-07', 100)])
    const currentCells = toMap([included('zeta', 'x', '2026-07', 110), included('alpha', 'x', '2026-07', 120)])
    const result = computeIndex({ period: '2026-07', baselinePeriod: '2025-07', basketCells, currentCells, baselineCells })
    expect(result.changes.map((c) => c.jobId)).toEqual(['alpha', 'zeta'])
  })

  it('methodology rule 3: takes exactly one argument (no weights parameter exists)', () => {
    expect(computeIndex.length).toBe(1)
  })

  it('returns baseline-only semantics gracefully (mean 0, full coverage reported as missing) when nothing is included', () => {
    const basketCells = [{ jobId: 'a', cityId: 'x' }]
    const result = computeIndex({
      period: '2026-07',
      baselinePeriod: '2025-07',
      basketCells,
      currentCells: new Map(),
      baselineCells: new Map(),
    })
    expect(result.cellsIncluded).toBe(0)
    expect(result.cellsMissing).toBe(1)
    expect(result.mean).toBe(0)
    expect(result.median).toBe(0)
  })
})
