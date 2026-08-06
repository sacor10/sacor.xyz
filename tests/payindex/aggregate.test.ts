import { describe, expect, it } from 'vitest'
import { buildCellValue } from '../../netlify/functions/_lib/payindex/aggregate'
import type { NormalizedObservation } from '../../netlify/functions/_lib/payindex/types'

function obs(
  id: number,
  annualPoint: number,
  sourceId = 'adzuna',
  sourceKind: NormalizedObservation['sourceKind'] = 'posting',
): NormalizedObservation {
  return {
    id,
    sourceId,
    sourceKind,
    jobId: 'retail-cashier',
    cityId: 'new-york-ny',
    period: '2026-07',
    rawMin: null,
    rawMax: null,
    rawPoint: annualPoint,
    payBasis: 'annual',
    annualPoint,
    sourceUrl: 'https://example.com',
    fetchedAt: '2026-07-01T00:00:00.000Z',
    sampleSize: 1,
    observationKey: `k${id}`,
  }
}

const base = { jobId: 'retail-cashier', cityId: 'new-york-ny', period: '2026-07' }

describe('buildCellValue (methodology rules 4 and 7)', () => {
  it('returns gap_no_data with zero observations', () => {
    const outcome = buildCellValue({ ...base, observations: [] })
    expect(outcome).toEqual({ kind: 'gap', ...base, reason: 'gap_no_data', observationCount: 0 })
  })

  it('returns gap_below_threshold with 1-4 observations', () => {
    const observations = [obs(1, 30000), obs(2, 31000), obs(3, 32000), obs(4, 33000)]
    const outcome = buildCellValue({ ...base, observations })
    expect(outcome).toEqual({ kind: 'gap', ...base, reason: 'gap_below_threshold', observationCount: 4 })
  })

  it('never interpolates, carries forward, or fabricates a value for a below-threshold cell', () => {
    const outcome = buildCellValue({ ...base, observations: [obs(1, 30000)] })
    expect(outcome.kind).toBe('gap')
    // A gap outcome structurally carries no numeric value field at all.
    expect('value' in outcome).toBe(false)
  })

  it('includes a cell at exactly 5 observations and computes the odd-count median', () => {
    const observations = [obs(1, 10), obs(2, 20), obs(3, 30), obs(4, 40), obs(5, 50)]
    const outcome = buildCellValue({ ...base, observations })
    expect(outcome.kind).toBe('cell')
    if (outcome.kind === 'cell') {
      expect(outcome.value.status).toBe('included')
      expect(outcome.value.medianAnnualPay).toBe(30)
      expect(outcome.value.observationCount).toBe(5)
    }
  })

  it('computes the even-count median as the mean of the two middle points', () => {
    const observations = [obs(1, 10), obs(2, 20), obs(3, 30), obs(4, 40), obs(5, 50), obs(6, 60)]
    const outcome = buildCellValue({ ...base, observations })
    expect(outcome.kind).toBe('cell')
    if (outcome.kind === 'cell') expect(outcome.value.medianAnnualPay).toBe(35)
  })

  it('is insensitive to input order', () => {
    const observations = [obs(1, 50), obs(2, 10), obs(3, 40), obs(4, 20), obs(5, 30)]
    const outcome = buildCellValue({ ...base, observations })
    expect(outcome.kind).toBe('cell')
    if (outcome.kind === 'cell') expect(outcome.value.medianAnnualPay).toBe(30)
  })

  it('rule 7: excludes aggregate-kind observations from the pool entirely, not just from the count label', () => {
    // 4 real postings (below threshold alone) plus 3 aggregate-kind
    // observations. If aggregates leaked into the pool this would be 7
    // observations (an included cell); the rule requires it stays a gap.
    const observations = [
      obs(1, 30000, 'adzuna', 'posting'),
      obs(2, 31000, 'adzuna', 'posting'),
      obs(3, 32000, 'adzuna', 'posting'),
      obs(4, 33000, 'adzuna', 'posting'),
      obs(5, 999999, 'levelsfyi', 'aggregate'),
      obs(6, 999999, 'levelsfyi', 'aggregate'),
      obs(7, 999999, 'levelsfyi', 'aggregate'),
    ]
    const outcome = buildCellValue({ ...base, observations })
    expect(outcome).toEqual({ kind: 'gap', ...base, reason: 'gap_below_threshold', observationCount: 4 })
  })

  it('rule 7: an included cell median is unaffected by aggregate-kind observations mixed in', () => {
    const postings = [obs(1, 10), obs(2, 20), obs(3, 30), obs(4, 40), obs(5, 50)]
    const withAggregate = [...postings, obs(6, 5_000_000, 'levelsfyi', 'aggregate')]
    const outcome = buildCellValue({ ...base, observations: withAggregate })
    expect(outcome.kind).toBe('cell')
    if (outcome.kind === 'cell') {
      expect(outcome.value.medianAnnualPay).toBe(30)
      expect(outcome.value.observationCount).toBe(5)
      expect(outcome.value.sourceIds).not.toContain('levelsfyi')
    }
  })

  it('pools raw observations across multiple sources into one median (never a median-of-per-source-medians)', () => {
    const observations = [
      obs(1, 100, 'adzuna'),
      obs(2, 200, 'ats-greenhouse'),
      obs(3, 300, 'adzuna'),
      obs(4, 400, 'ats-lever'),
      obs(5, 500, 'union-wage-scale', 'scale'),
    ]
    const outcome = buildCellValue({ ...base, observations })
    expect(outcome.kind).toBe('cell')
    // Pooled median of [100,200,300,400,500] is 300 — NOT the mean of
    // per-source medians (adzuna: median(100,300)=200, greenhouse: 200,
    // lever: 400, scale: 500 -> mean of those would be 325).
    if (outcome.kind === 'cell') expect(outcome.value.medianAnnualPay).toBe(300)
  })
})
