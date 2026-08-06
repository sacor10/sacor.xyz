import { describe, expect, it } from 'vitest'
import { carrierPayAdapter } from '../../../netlify/functions/_lib/payindex/adapters/roles/carrierPay'
import type { AdapterContext } from '../../../netlify/functions/_lib/payindex/adapters/index'
import { jobs } from '../../../src/data/payIndex/jobs'
import { cities } from '../../../src/data/payIndex/cities'
import { carrierPayEntries } from '../../../src/data/payIndex/roleSources'

const heavyTruckDriver = jobs.find((j) => j.id === 'heavy-truck-driver')!
const dallas = cities.find((c) => c.id === 'dallas-tx')!
const denver = cities.find((c) => c.id === 'denver-co')!
// There are two configured carrier entries for this job (roleSources.ts) —
// pin the fixture to just the first one so these tests exercise exactly one
// page's content instead of two.
const schneiderUrl = carrierPayEntries.find((e) => e.id === 'schneider-otr-driver-pay')!.url

function stubContext(htmlByUrl: (url: string) => string): AdapterContext {
  return {
    period: '2026-07',
    http: {
      fetchText: async (url: string) => htmlByUrl(url),
      fetchJson: async () => {
        throw new Error('not used')
      },
    },
    log: () => {},
  }
}

describe('carrierPayAdapter', () => {
  it('extracts a disclosed annual figure while ignoring a nearby CPM rate', async () => {
    const html = `<p>Now hiring OTR drivers out of our Dallas, TX terminal.
      Drivers earn $0.55 to $0.65 per mile. Average annual pay is
      $78,000 - $95,000 depending on experience.</p>`
    const observations = await carrierPayAdapter.fetchObservations(
      heavyTruckDriver,
      dallas,
      '2026-07',
      stubContext((url) => (url === schneiderUrl ? html : '<p>Now hiring nationwide.</p>')),
    )
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({ rawMin: 78000, rawMax: 95000, payBasis: 'annual', cityId: 'dallas-tx' })
  })

  it('never attributes a national rate to a city the page does not name', async () => {
    const html = `<p>Now hiring OTR drivers nationwide. Average annual pay is $78,000 - $95,000.</p>`
    const observations = await carrierPayAdapter.fetchObservations(heavyTruckDriver, denver, '2026-07', stubContext(() => html))
    expect(observations).toEqual([])
  })

  it('returns nothing when only a CPM rate is disclosed with no annual figure', async () => {
    const html = `<p>Now hiring in Dallas, TX. Drivers earn $0.55 to $0.65 per mile.</p>`
    const observations = await carrierPayAdapter.fetchObservations(heavyTruckDriver, dallas, '2026-07', stubContext(() => html))
    expect(observations).toEqual([])
  })
})
