import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory stand-in for Netlify Blobs so the config API works without the
// Netlify runtime.
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

import handler from '../../netlify/functions/in-stock-alerts.mts'
import { SEED_WATCH } from '../../netlify/functions/_lib/instock/watches'
import { signSession } from '../../netlify/functions/_lib/session.mjs'

const EMAIL = 'tester@example.com'
const URL_BASE = 'https://sacor.xyz/.netlify/functions/in-stock-alerts'

const call = (method: string, { body, email = EMAIL, query = '' }: { body?: unknown; email?: string | null; query?: string } = {}) =>
  handler(
    new Request(`${URL_BASE}${query}`, {
      method,
      headers: {
        ...(email ? { cookie: `sacor_session=${signSession({ email, picture: '' })}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )

beforeEach(() => {
  blobData.clear()
  vi.stubEnv('SESSION_SECRET', 'unit-test-secret-32-bytes-long!!')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('in-stock-alerts config API', () => {
  it('requires a signed-in session', async () => {
    const res = await call('GET', { email: null })
    expect(res.status).toBe(401)
  })

  it('seeds the Zelda watch on the first read and persists it', async () => {
    const res = await call('GET')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email).toBe(EMAIL)
    expect(body.watches).toHaveLength(1)
    expect(body.watches[0].url).toBe(SEED_WATCH.url)
    expect(body.watches[0].notifyEmail).toBe(true)
    expect(body.watches[0].notifySms).toBe(true)
    expect(blobData.size).toBe(1)
  })

  it('advertises what the server can actually deliver', async () => {
    vi.stubEnv('RESEND_API_KEY', 'key')
    vi.stubEnv('RESEND_FROM_EMAIL', 'alerts@sacor.xyz')
    const body = await (await call('GET')).json()
    expect(body.capabilities.email).toBe(true)
    expect(body.capabilities.twilio).toBe(false)
    expect(body.capabilities.carriers).toContain('verizon')
    expect(body.capabilities.minIntervalMs).toBe(120000)
    expect(body.capabilities.maxIntervalMs).toBe(300000)
  })

  it('saves an edited watch list', async () => {
    await call('GET')
    const res = await call('PUT', {
      body: {
        email: EMAIL,
        phone: '(555) 123-4567',
        carrier: 'verizon',
        watches: [
          { label: 'Zelda', url: SEED_WATCH.url },
          { label: 'Other', url: 'https://example.com/thing', match: { mode: 'contains', text: 'Add to Cart' } },
        ],
      },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.phone).toBe('+15551234567')
    expect(body.carrier).toBe('verizon')
    expect(body.watches).toHaveLength(2)
    expect(body.watches[1].match).toEqual({ mode: 'contains', text: 'Add to Cart' })

    const reread = await (await call('GET')).json()
    expect(reread.watches).toHaveLength(2)
  })

  it('refuses a watch pointed at an internal address', async () => {
    await call('GET')
    const res = await call('PUT', { body: { watches: [{ url: 'http://169.254.169.254/latest/meta-data/' }] } })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/private|internal/i)
  })

  it('rejects a malformed body', async () => {
    await call('GET')
    const res = await call('PUT', { body: { watches: 'nope' } })
    expect(res.status).toBe(400)
  })

  it('404s a check for a watch that does not exist', async () => {
    await call('GET')
    const res = await call('POST', { query: '?check=nope' })
    expect(res.status).toBe(404)
  })

  it('checks one page on demand', async () => {
    const seeded = await (await call('GET')).json()
    const id = seeded.watches[0].id
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<p>Sold out</p>', { status: 200 })))

    const res = await call('POST', { query: `?check=${id}` })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.watches[0].status).toBe('out_of_stock')
    expect(body.watches[0].lastCheckedAt).toBeTruthy()
    expect(body.watches[0].nextCheckAt).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('rate-limits back-to-back manual checks', async () => {
    const seeded = await (await call('GET')).json()
    const id = seeded.watches[0].id
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<p>Sold out</p>', { status: 200 })))

    expect((await call('POST', { query: `?check=${id}` })).status).toBe(200)
    expect((await call('POST', { query: `?check=${id}` })).status).toBe(429)
    vi.unstubAllGlobals()
  })

  it('rejects unsupported methods', async () => {
    const res = await call('DELETE')
    expect(res.status).toBe(405)
  })
})
