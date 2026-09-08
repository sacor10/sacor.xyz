import { describe, expect, it } from 'vitest'
import { checkWatch } from '../../netlify/functions/_lib/instock/runner'
import { ALERT_COOLDOWN_MS, defaultConfig } from '../../netlify/functions/_lib/instock/watches'
import type { Watch } from '../../netlify/functions/_lib/instock/types'

const NOW = Date.parse('2026-02-01T12:00:00.000Z')
const base = (patch: Partial<Watch> = {}): Watch => ({ ...defaultConfig('me@example.com').watches[0], ...patch })

const withPage = (html: string) => ({ now: NOW, random: () => 0, fetchHtml: async () => html })

const SOLD_OUT = '<p>Sold out</p>'
const IN_STOCK = '<button>Add to Cart</button>'

describe('checkWatch', () => {
  it('alerts on the sold-out to in-stock transition', async () => {
    const outcome = await checkWatch(base({ status: 'out_of_stock' }), withPage(IN_STOCK))
    expect(outcome.watch.status).toBe('in_stock')
    expect(outcome.shouldAlert).toBe(true)
    expect(outcome.watch.lastInStockAt).toBe(new Date(NOW).toISOString())
  })

  it('alerts on the very first check when the page is already buyable', async () => {
    const outcome = await checkWatch(base({ status: 'unknown' }), withPage(IN_STOCK))
    expect(outcome.shouldAlert).toBe(true)
  })

  it('does not re-alert while the page stays in stock', async () => {
    const outcome = await checkWatch(base({ status: 'in_stock' }), withPage(IN_STOCK))
    expect(outcome.shouldAlert).toBe(false)
  })

  it('never alerts for a sold-out page', async () => {
    const outcome = await checkWatch(base({ status: 'in_stock' }), withPage(SOLD_OUT))
    expect(outcome.watch.status).toBe('out_of_stock')
    expect(outcome.shouldAlert).toBe(false)
  })

  it('honours the alert cooldown for a flapping page', async () => {
    const recent = new Date(NOW - ALERT_COOLDOWN_MS + 60_000).toISOString()
    const outcome = await checkWatch(base({ status: 'out_of_stock', lastAlertAt: recent }), withPage(IN_STOCK))
    expect(outcome.watch.status).toBe('in_stock')
    expect(outcome.shouldAlert).toBe(false)
  })

  it('alerts again once the cooldown has expired', async () => {
    const old = new Date(NOW - ALERT_COOLDOWN_MS - 1000).toISOString()
    const outcome = await checkWatch(base({ status: 'out_of_stock', lastAlertAt: old }), withPage(IN_STOCK))
    expect(outcome.shouldAlert).toBe(true)
  })

  it('reschedules inside the 2–5 minute window after a good check', async () => {
    const outcome = await checkWatch(base(), { ...withPage(SOLD_OUT), random: () => 0.5 })
    const delta = Date.parse(outcome.watch.nextCheckAt as string) - NOW
    expect(delta).toBeGreaterThanOrEqual(2 * 60 * 1000)
    expect(delta).toBeLessThanOrEqual(5 * 60 * 1000)
  })

  it('backs off and never alerts when the fetch fails', async () => {
    const outcome = await checkWatch(base({ status: 'out_of_stock', consecutiveErrors: 1 }), {
      now: NOW,
      fetchHtml: async () => {
        throw new Error('HTTP 503')
      },
    })
    expect(outcome.watch.status).toBe('error')
    expect(outcome.watch.consecutiveErrors).toBe(2)
    expect(outcome.error).toBe('HTTP 503')
    expect(outcome.shouldAlert).toBe(false)
    expect(Date.parse(outcome.watch.nextCheckAt as string) - NOW).toBeGreaterThan(5 * 60 * 1000)
  })

  it('clears the error counter after a check succeeds', async () => {
    const outcome = await checkWatch(base({ consecutiveErrors: 3, status: 'error' }), withPage(SOLD_OUT))
    expect(outcome.watch.consecutiveErrors).toBe(0)
  })
})
