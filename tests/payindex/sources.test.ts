import { describe, expect, it } from 'vitest'
import { sources } from '../../src/data/payIndex/sources'
import { unionScaleEntries, districtScheduleEntries, vivianEntries, carrierPayEntries } from '../../src/data/payIndex/roleSources'
import { isGovernmentUrl } from '../../netlify/functions/_lib/payindex/govHosts'

function collectConfiguredUrls(): { label: string; url: string }[] {
  const urls: { label: string; url: string }[] = []
  for (const s of sources) {
    if (s.homepageUrl) urls.push({ label: `sources.ts:${s.id}`, url: s.homepageUrl })
  }
  for (const e of unionScaleEntries) urls.push({ label: `roleSources.ts:${e.id}`, url: e.url })
  for (const e of districtScheduleEntries) urls.push({ label: `roleSources.ts:${e.id}`, url: e.url })
  for (const e of vivianEntries) urls.push({ label: `roleSources.ts:${e.id}`, url: e.searchUrl })
  for (const e of carrierPayEntries) urls.push({ label: `roleSources.ts:${e.id}`, url: e.url })
  return urls
}

describe('methodology rule 9: no government data', () => {
  it('rejects known government hosts', () => {
    expect(isGovernmentUrl('https://www.bls.gov/oes/current/oes_nat.htm')).toBe(true)
    expect(isGovernmentUrl('https://data.census.gov/table')).toBe(true)
    expect(isGovernmentUrl('https://schools.austintx.gov/salary')).toBe(true)
    expect(isGovernmentUrl('https://losangeles.k12.ca.us/pay')).toBe(true)
  })

  it('does not flag ordinary commercial/non-profit hosts', () => {
    expect(isGovernmentUrl('https://www.adzuna.com')).toBe(false)
    expect(isGovernmentUrl('https://www.vivian.com')).toBe(false)
    expect(isGovernmentUrl('https://www.ibew3.org/wages-benefits')).toBe(false)
    expect(isGovernmentUrl('https://www.uft.org/your-rights/salary')).toBe(false)
  })

  it('no configured source URL in the Pay Index registries is a government host', () => {
    const offenders = collectConfiguredUrls().filter(({ url }) => isGovernmentUrl(url))
    expect(offenders).toEqual([])
  })
})

describe('source registry attribution consistency', () => {
  it('never requires attribution without providing attribution text', () => {
    for (const s of sources) {
      if (s.attributionRequired) {
        expect(s.attributionText.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('every source has a unique id', () => {
    const ids = sources.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("levelsfyi is registered as an 'aggregate' source (excluded from the headline by rule 7)", () => {
    const levelsfyi = sources.find((s) => s.id === 'levelsfyi')
    expect(levelsfyi?.kind).toBe('aggregate')
  })
})
