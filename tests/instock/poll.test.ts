import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const blobData = new Map<string, string>()
vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    get: async (key: string) => blobData.get(key) ?? null,
    set: async (key: string, value: string) => {
      blobData.set(key, value)
    },
    list: async ({ prefix }: { prefix: string }) => ({
      blobs: [...blobData.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
    }),
  }),
}))

import poll, { config as scheduleConfig } from '../../netlify/functions/in-stock-alerts-poll.mts'
import { configKey } from '../../netlify/functions/_lib/instock/store'
import { defaultConfig } from '../../netlify/functions/_lib/instock/watches'
import type { AlertConfig, Watch } from '../../netlify/functions/_lib/instock/types'

const EMAIL = 'tester@example.com'
const PRODUCT = 'https://example.com/product'

const seed = (watch: Partial<Watch> = {}, config: Partial<AlertConfig> = {}) => {
  const base = defaultConfig(EMAIL)
  const stored: AlertConfig = {
    ...base,
    phone: '+15551234567',
    carrier: 'verizon',
    ...config,
    watches: [{ ...base.watches[0], url: PRODUCT, label: 'Thing', ...watch }],
  }
  blobData.set(configKey(EMAIL), JSON.stringify(stored))
  return stored
}

const readBack = (): AlertConfig => JSON.parse(blobData.get(configKey(EMAIL)) as string)

/** Routes the product fetch and the Resend call to separate canned responses. */
const stubNetwork = (pageHtml: string) => {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input)
      calls.push(url)
      if (url.startsWith('https://api.resend.com')) {
        return new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 })
      }
      return new Response(pageHtml, { status: 200 })
    }),
  )
  return calls
}

beforeEach(() => {
  blobData.clear()
  vi.stubEnv('SESSION_SECRET', 'unit-test-secret-32-bytes-long!!')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('RESEND_FROM_EMAIL', 'alerts@sacor.xyz')
  vi.stubEnv('SITE_URL', 'https://sacor.xyz')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('in-stock-alerts scheduled poller', () => {
  it('runs every minute so the per-watch 2–5 minute schedules stay honest', () => {
    expect(scheduleConfig.schedule).toBe('* * * * *')
  })

  it('checks a due watch and records the result', async () => {
    seed({ status: 'out_of_stock', nextCheckAt: null })
    stubNetwork('<p>Sold out</p>')

    const body = await (await poll()).json()
    expect(body.checked).toBe(1)
    expect(body.alerted).toBe(0)

    const watch = readBack().watches[0]
    expect(watch.status).toBe('out_of_stock')
    expect(Date.parse(watch.nextCheckAt as string)).toBeGreaterThan(Date.now())
  })

  it('skips a watch that is not due yet', async () => {
    seed({ status: 'out_of_stock', nextCheckAt: new Date(Date.now() + 4 * 60_000).toISOString() })
    const calls = stubNetwork('<button>Add to Cart</button>')

    const body = await (await poll()).json()
    expect(body.checked).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it('skips a disabled watch', async () => {
    seed({ enabled: false, nextCheckAt: null })
    stubNetwork('<button>Add to Cart</button>')
    expect((await (await poll()).json()).checked).toBe(0)
  })

  it('sends email and text on the restock, then records the alert', async () => {
    seed({ status: 'out_of_stock', nextCheckAt: null })
    const calls = stubNetwork('<button>Add to Cart</button>')

    const body = await (await poll()).json()
    expect(body.alerted).toBe(1)

    // One product fetch, then two Resend calls: the email and the SMS gateway.
    expect(calls.filter((url) => url.startsWith('https://api.resend.com'))).toHaveLength(2)

    const saved = readBack()
    expect(saved.watches[0].status).toBe('in_stock')
    expect(saved.watches[0].lastAlertAt).toBeTruthy()
    expect(saved.events).toHaveLength(1)
    expect(saved.events[0].channels).toEqual(['email', 'text'])
  })

  it('only emails when no phone is saved', async () => {
    seed({ status: 'out_of_stock', nextCheckAt: null }, { phone: '', carrier: '' })
    const calls = stubNetwork('<button>Add to Cart</button>')

    await poll()
    expect(calls.filter((url) => url.startsWith('https://api.resend.com'))).toHaveLength(1)
    expect(readBack().events[0].channels).toEqual(['email'])
  })

  it('does not alert twice while the page stays in stock', async () => {
    seed({ status: 'in_stock', nextCheckAt: null })
    stubNetwork('<button>Add to Cart</button>')

    expect((await (await poll()).json()).alerted).toBe(0)
    expect(readBack().events).toHaveLength(0)
  })
})
