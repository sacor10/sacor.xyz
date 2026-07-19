import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildWav } from '../../src/lib/songid/wav'

// In-memory stand-in for Netlify Blobs so the handler's counters and cache
// work without the Netlify runtime.
const blobData = new Map<string, string>()
vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    get: async (key: string) => blobData.get(key) ?? null,
    set: async (key: string, value: string) => {
      blobData.set(key, value)
    },
  }),
}))

import handler from '../../netlify/functions/song-identify.mts'
import { signSession } from '../../netlify/functions/_lib/session.mjs'

const auddMatch = readFileSync(join(__dirname, 'fixtures/audd-match.json'), 'utf8')
const auddNoMatch = readFileSync(join(__dirname, 'fixtures/audd-no-match.json'), 'utf8')

const stubAudd = (body: string) => {
  const impl = vi.fn(async () => new Response(body, { status: 200 }))
  vi.stubGlobal('fetch', impl)
  return impl
}

const wavClip = (seconds = 10, seed = 1) =>
  buildWav(Int16Array.from({ length: 8000 * seconds }, (_, i) => ((i * seed * 31) % 4096) - 2048), 8000)

const post = (body: Uint8Array | ArrayBuffer, email: string | null = 'tester@example.com') =>
  handler(
    new Request('https://sacor.xyz/.netlify/functions/song-identify', {
      method: 'POST',
      headers: email ? { cookie: `sacor_session=${signSession({ email, picture: '' })}` } : {},
      body: body instanceof Uint8Array
        ? body.slice().buffer as ArrayBuffer
        : body,
    }),
  )

beforeEach(() => {
  blobData.clear()
  vi.stubEnv('AUDD_API_TOKEN', 'test-token')
  vi.stubEnv('SESSION_SECRET', 'unit-test-secret-32-bytes-long!!')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('song-identify handler', () => {
  it('returns 503 when the kill switch is on', async () => {
    vi.stubEnv('SONG_ID_DISABLED', 'true')
    const res = await post(wavClip())
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code: 'disabled' })
  })

  it('rejects non-POST', async () => {
    const res = await handler(new Request('https://x/', { method: 'GET' }))
    expect(res.status).toBe(405)
  })

  it('rejects anonymous and forged-cookie requests with 401', async () => {
    const noCookie = await post(wavClip(), null)
    expect(noCookie.status).toBe(401)
    expect(await noCookie.json()).toMatchObject({ code: 'auth_required' })

    const forged = await handler(
      new Request('https://x/', {
        method: 'POST',
        headers: { cookie: 'sacor_session=not.a.real.token' },
        body: wavClip().slice().buffer as ArrayBuffer,
      }),
    )
    expect(forged.status).toBe(401)
  })

  it('returns 503 when SESSION_SECRET is unset (auth unverifiable)', async () => {
    vi.stubEnv('SESSION_SECRET', '')
    const res = await handler(
      new Request('https://x/', {
        method: 'POST',
        // well-formed body.sig token so verification reaches the HMAC (and the missing secret)
        headers: { cookie: 'sacor_session=abc.def' },
        body: wavClip().slice().buffer as ArrayBuffer,
      }),
    )
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code: 'not_configured' })
  })

  it('rejects a non-WAV body with clean JSON, not a stack trace', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(100).fill(0)])
    const res = await post(png)
    expect(res.status).toBe(415)
    const body = await res.json()
    expect(body).toEqual({ code: 'unsupported_media', message: expect.stringContaining('WAV') })
  })

  it('rejects oversized and overlong clips', async () => {
    const big = new Uint8Array(1_600_000)
    expect((await post(big)).status).toBe(413)
    const long = wavClip(14)
    const res = await post(long)
    expect(res.status).toBe(413)
    expect(await res.json()).toMatchObject({ code: 'clip_too_long' })
  })

  it('identifies a clip, then serves the repeat from cache with no provider call', async () => {
    const fetchImpl = stubAudd(auddMatch)
    const clip = wavClip()

    const first = await post(clip)
    expect(first.status).toBe(200)
    const outcome = await first.json()
    expect(outcome).toMatchObject({
      status: 'match',
      attemptsUsed: 1,
      matchedFactor: 1,
      result: { title: 'Warriors', artist: 'Imagine Dragons' },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const second = await post(clip)
    expect(second.status).toBe(200)
    expect(await second.json()).toMatchObject({ status: 'match', cached: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1) // cache hit spent nothing
  })

  it('sweeps up to the attempt cap on no-match', async () => {
    const fetchImpl = stubAudd(auddNoMatch)
    vi.stubEnv('SONG_ID_MAX_SWEEP_ATTEMPTS', '3')
    const res = await post(wavClip(10, 3))
    expect(await res.json()).toMatchObject({ status: 'no_match', attemptsUsed: 3 })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('returns 429 with a useful message once the per-user hourly limit is hit', async () => {
    stubAudd(auddNoMatch)
    vi.stubEnv('SONG_ID_RATE_LIMIT_PER_HOUR', '2')
    const clip = wavClip(10, 7)
    expect((await post(clip, 'heavy@example.com')).status).toBe(200)
    expect((await post(clip, 'heavy@example.com')).status).toBe(200)
    const limited = await post(clip, 'heavy@example.com')
    expect(limited.status).toBe(429)
    expect(await limited.json()).toMatchObject({
      code: 'rate_limited',
      message: expect.stringContaining('2 lookups per hour'),
    })
    // a different signed-in user is unaffected
    expect((await post(wavClip(10, 8), 'other@example.com')).status).toBe(200)
  })

  it('returns 503 quota_exhausted when the monthly cap is already spent', async () => {
    stubAudd(auddNoMatch)
    vi.stubEnv('SONG_ID_MONTHLY_CALL_CAP', '1')
    expect((await post(wavClip(10, 11), 'a@example.com')).status).toBe(200) // spends the 1 call
    const res = await post(wavClip(10, 12), 'b@example.com')
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code: 'quota_exhausted' })
  })

  it('maps provider errors to 502', async () => {
    stubAudd(readFileSync(join(__dirname, 'fixtures/audd-error.json'), 'utf8'))
    const res = await post(wavClip(10, 21), 'c@example.com')
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ code: 'provider_error' })
  })
})
