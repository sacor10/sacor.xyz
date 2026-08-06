import { describe, expect, it } from 'vitest'
import { matchesJob, matchesCity } from '../../netlify/functions/_lib/payindex/matching'
import { jobs } from '../../src/data/payIndex/jobs'
import { cities } from '../../src/data/payIndex/cities'

const registeredNurse = jobs.find((j) => j.id === 'registered-nurse')!
const journeymanElectrician = jobs.find((j) => j.id === 'journeyman-electrician')!
const newYork = cities.find((c) => c.id === 'new-york-ny')!
const losAngeles = cities.find((c) => c.id === 'los-angeles-ca')!

describe('matchesJob', () => {
  it('matches on a canonical keyword', () => {
    expect(matchesJob('Registered Nurse - ICU', registeredNurse)).toBe(true)
  })

  it('rejects a title that only matches via a negative keyword', () => {
    expect(matchesJob('Nurse Practitioner, Family Medicine', registeredNurse)).toBe(false)
  })

  it('rejects an apprentice posting from matching the journeyman title', () => {
    expect(matchesJob('Apprentice Electrician - 2nd year', journeymanElectrician)).toBe(false)
  })

  it('rejects titles with no keyword overlap at all', () => {
    expect(matchesJob('Marketing Coordinator', registeredNurse)).toBe(false)
  })
})

describe('matchesCity', () => {
  it('matches the plain city name', () => {
    expect(matchesCity('New York, NY', newYork)).toBe(true)
  })

  it('matches common aliases', () => {
    expect(matchesCity('NYC (Manhattan)', newYork)).toBe(true)
    expect(matchesCity('LA - Downtown', losAngeles)).toBe(true)
  })

  it('rejects a city with no name/alias match', () => {
    expect(matchesCity('Denver, CO', newYork)).toBe(false)
  })

  it('rejects a remote posting that only mentions the city in passing', () => {
    expect(matchesCity('Remote — must reside near New York, NY', newYork)).toBe(false)
  })

  it('accepts a posting that is city-first even if "remote" appears later in the text', () => {
    expect(matchesCity('New York, NY (Hybrid/Remote days available)', newYork)).toBe(true)
  })
})
