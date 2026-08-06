import { describe, expect, it } from 'vitest'
import { jobs } from '../../src/data/payIndex/jobs'
import { cities } from '../../src/data/payIndex/cities'
import { changelog } from '../../src/data/payIndex/changelog'
import { BASKET_VERSION, MIN_OBSERVATIONS, ANNUALIZATION_HOURS } from '../../src/data/payIndex/basket'

describe('job basket', () => {
  it('has between 50 and 150 titles (spec floor/ceiling)', () => {
    expect(jobs.length).toBeGreaterThanOrEqual(50)
    expect(jobs.length).toBeLessThanOrEqual(150)
  })

  it('has unique ids', () => {
    const ids = jobs.map((j) => j.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every job has at least one canonical keyword', () => {
    for (const j of jobs) {
      expect(j.canonicalKeywords.length).toBeGreaterThan(0)
    }
  })

  it('every job is tagged with the current basket version and is active', () => {
    for (const j of jobs) {
      expect(j.basketVersion).toBe(BASKET_VERSION)
      expect(j.active).toBe(true)
    }
  })

  it('spans more than one category (not tech-skewed, per spec)', () => {
    const categories = new Set(jobs.map((j) => j.category))
    expect(categories.size).toBeGreaterThanOrEqual(8)
  })
})

describe('city basket', () => {
  it('has at least 12 metros', () => {
    expect(cities.length).toBeGreaterThanOrEqual(12)
  })

  it('has unique ids', () => {
    const ids = cities.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every city is tagged with the current basket version and is active', () => {
    for (const c of cities) {
      expect(c.basketVersion).toBe(BASKET_VERSION)
      expect(c.active).toBe(true)
    }
  })

  it('spans more than one region', () => {
    const regions = new Set(cities.map((c) => c.region))
    expect(regions.size).toBeGreaterThan(1)
  })
})

describe('changelog', () => {
  it('has at least one entry for the current basket version', () => {
    expect(changelog.some((e) => e.basketVersion === BASKET_VERSION)).toBe(true)
  })

  it('every entry has a non-empty detail', () => {
    for (const e of changelog) {
      expect(e.detail.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('methodology constants', () => {
  it('minimum observation threshold matches the spec (>=5)', () => {
    expect(MIN_OBSERVATIONS).toBe(5)
  })

  it('annualizes hourly pay at 2080 hours (the spec-mandated basis)', () => {
    expect(ANNUALIZATION_HOURS).toBe(2080)
  })
})
