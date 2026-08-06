import { describe, expect, it } from 'vitest'
import { parsePayBand } from '../../../netlify/functions/_lib/payindex/adapters/ats/parseBand'

describe('parsePayBand — must match', () => {
  const cases: [string, { min: number; max: number; basis: 'hourly' | 'annual' }][] = [
    ['The pay range for this role is $120,000 - $150,000.', { min: 120000, max: 150000, basis: 'annual' }],
    ['Compensation: $120K–$150K depending on experience.', { min: 120000, max: 150000, basis: 'annual' }],
    ['We pay $57.50 to $72.00 per hour for this position.', { min: 57.5, max: 72, basis: 'hourly' }],
    ['Salary range $95,000 to $115,000 annually.', { min: 95000, max: 115000, basis: 'annual' }],
    ['Hourly rate $18.00 - $24.00 hourly, paid biweekly.', { min: 18, max: 24, basis: 'hourly' }],
  ]

  for (const [text, expected] of cases) {
    it(`parses "${text}"`, () => {
      expect(parsePayBand(text)).toEqual(expected)
    })
  }
})

describe('parsePayBand — must NOT match (reject rather than fabricate)', () => {
  const cases: string[] = [
    'Competitive compensation package and great benefits.',
    'Base salary $120,000 plus equity.',
    'Includes an equity grant valued $50,000 - $100,000.',
    'Sign-on bonus: $10,000 - $15,000 for new hires.',
    'Target bonus $20,000 - $40,000 on top of base pay.',
    '$1,000 - $600,000 depending on the role.', // absurd ratio
    '$2.00 - $700.00 per hour.', // out of sane hourly bounds
    '$500 - $2,000 annually.', // out of sane annual bounds
    'Relocation assistance $5,000 - $10,000 available.',
  ]

  for (const text of cases) {
    it(`rejects "${text}"`, () => {
      expect(parsePayBand(text)).toBeNull()
    })
  }
})
