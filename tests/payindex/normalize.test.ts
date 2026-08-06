import { describe, expect, it } from 'vitest'
import { normalizeToAnnual } from '../../netlify/functions/_lib/payindex/normalize'

describe('normalizeToAnnual', () => {
  it('annualizes an hourly point figure at 2080 hours/year', () => {
    expect(normalizeToAnnual({ rawMin: null, rawMax: null, rawPoint: 50, payBasis: 'hourly' }).annualPoint).toBe(
      50 * 2080,
    )
  })

  it('passes an annual point figure through unchanged', () => {
    expect(normalizeToAnnual({ rawMin: null, rawMax: null, rawPoint: 80000, payBasis: 'annual' }).annualPoint).toBe(
      80000,
    )
  })

  it('derives the midpoint when only a min/max range is given', () => {
    const result = normalizeToAnnual({ rawMin: 40, rawMax: 60, rawPoint: null, payBasis: 'hourly' })
    expect(result.annualPoint).toBe(50 * 2080)
  })

  it('prefers rawPoint over a min/max range when both are present', () => {
    const result = normalizeToAnnual({ rawMin: 10, rawMax: 90, rawPoint: 55, payBasis: 'hourly' })
    expect(result.annualPoint).toBe(55 * 2080)
  })

  it('throws when there is neither a point nor a usable range', () => {
    expect(() => normalizeToAnnual({ rawMin: null, rawMax: 60, rawPoint: null, payBasis: 'hourly' })).toThrow()
    expect(() => normalizeToAnnual({ rawMin: null, rawMax: null, rawPoint: null, payBasis: 'annual' })).toThrow()
  })

  it('methodology rule 2: takes exactly one argument (no period/adjustment-factor param exists)', () => {
    expect(normalizeToAnnual.length).toBe(1)
  })
})
