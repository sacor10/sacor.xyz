import { describe, expect, it } from 'vitest'
import { jobs } from '../../src/data/payIndex/jobs'
import { cities } from '../../src/data/payIndex/cities'
import { BASKET_FINGERPRINT } from '../../src/data/payIndex/basket'
import { computeBasketFingerprint } from '../../netlify/functions/_lib/payindex/fingerprint'

describe('basket fingerprint (methodology rule 1: fixed basket)', () => {
  it('matches the checked-in BASKET_FINGERPRINT', () => {
    // If this fails, the basket (jobs.ts/cities.ts) was edited without
    // following the required protocol: bump BASKET_VERSION, add a dated
    // changelog.ts entry, then regenerate BASKET_FINGERPRINT in basket.ts.
    // See the header comment in basket.ts for the regeneration command.
    expect(computeBasketFingerprint(jobs, cities)).toBe(BASKET_FINGERPRINT)
  })

  it('is sensitive to any single job field changing', () => {
    const base = computeBasketFingerprint(jobs, cities)
    const mutated = jobs.map((j, i) => (i === 0 ? { ...j, title: `${j.title} (edited)` } : j))
    expect(computeBasketFingerprint(mutated, cities)).not.toBe(base)
  })

  it('is sensitive to any single city field changing', () => {
    const base = computeBasketFingerprint(jobs, cities)
    const mutated = cities.map((c, i) => (i === 0 ? { ...c, region: 'Midwest' as const } : c))
    expect(computeBasketFingerprint(jobs, mutated)).not.toBe(base)
  })

  it('is insensitive to array order (canonicalized before hashing)', () => {
    const base = computeBasketFingerprint(jobs, cities)
    const reordered = computeBasketFingerprint([...jobs].reverse(), [...cities].reverse())
    expect(reordered).toBe(base)
  })

  it('is deterministic', () => {
    expect(computeBasketFingerprint(jobs, cities)).toBe(computeBasketFingerprint(jobs, cities))
  })
})
