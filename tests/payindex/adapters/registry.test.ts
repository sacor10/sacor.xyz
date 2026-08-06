import { describe, expect, it } from 'vitest'
import { allAdapters } from '../../../netlify/functions/_lib/payindex/adapters/registry'

describe('allAdapters registry', () => {
  it('has a unique id per adapter', () => {
    const ids = allAdapters.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes one Tier A adapter, four Tier B adapters, and five Tier C adapters', () => {
    const byTier = { A: 0, B: 0, C: 0 }
    for (const a of allAdapters) byTier[a.tier]++
    expect(byTier).toEqual({ A: 1, B: 4, C: 5 })
  })

  it('every adapter exposes a working preflight/covers/fetchObservations contract', () => {
    for (const adapter of allAdapters) {
      expect(typeof adapter.preflight).toBe('function')
      expect(typeof adapter.covers).toBe('function')
      expect(typeof adapter.fetchObservations).toBe('function')
      expect(adapter.sourceIds.length).toBeGreaterThan(0)
    }
  })
})
