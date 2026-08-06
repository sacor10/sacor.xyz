import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHttpContext } from '../../netlify/functions/_lib/payindex/http'

let cacheDir: string

beforeEach(() => {
  cacheDir = mkdtempSync(path.join(tmpdir(), 'pay-index-http-test-'))
})

afterEach(() => {
  rmSync(cacheDir, { recursive: true, force: true })
})

function fakeFetch(handler: (url: string) => { status: number; body: string }): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    const { status, body } = handler(url)
    return new Response(body, { status })
  }) as typeof fetch
}

describe('createHttpContext', () => {
  it('refuses to fetch a government host', async () => {
    const http = createHttpContext({ cacheDir, fetchImpl: fakeFetch(() => ({ status: 200, body: '{}' })) })
    await expect(http.fetchText('https://www.bls.gov/oes/current/oes_nat.htm')).rejects.toThrow(/government/)
  })

  it('honors robots.txt Disallow for the requested path', async () => {
    let calls = 0
    const http = createHttpContext({
      cacheDir,
      fetchImpl: fakeFetch((url) => {
        calls++
        if (url.endsWith('/robots.txt')) return { status: 200, body: 'User-agent: *\nDisallow: /private/\n' }
        return { status: 200, body: 'ok' }
      }),
    })
    await expect(http.fetchText('https://example.com/private/page')).rejects.toThrow(/robots/)
    expect(calls).toBe(1) // only the robots.txt fetch happened, not the disallowed page
  })

  it('allows a path robots.txt does not disallow', async () => {
    const http = createHttpContext({
      cacheDir,
      fetchImpl: fakeFetch((url) => {
        if (url.endsWith('/robots.txt')) return { status: 200, body: 'User-agent: *\nDisallow: /private/\n' }
        return { status: 200, body: 'public content' }
      }),
    })
    await expect(http.fetchText('https://example.com/public/page')).resolves.toBe('public content')
  })

  it('caches identical requests so a second fetch does not hit the network again', async () => {
    let networkCalls = 0
    const http = createHttpContext({
      cacheDir,
      fetchImpl: fakeFetch((url) => {
        if (url.endsWith('/robots.txt')) return { status: 200, body: '' }
        networkCalls++
        return { status: 200, body: 'fresh content' }
      }),
    })
    const first = await http.fetchText('https://example.com/data')
    const second = await http.fetchText('https://example.com/data')
    expect(first).toBe('fresh content')
    expect(second).toBe('fresh content')
    expect(networkCalls).toBe(1)
  })

  it('parses JSON responses via fetchJson', async () => {
    const http = createHttpContext({
      cacheDir,
      fetchImpl: fakeFetch((url) => {
        if (url.endsWith('/robots.txt')) return { status: 200, body: '' }
        return { status: 200, body: JSON.stringify({ hello: 'world' }) }
      }),
    })
    await expect(http.fetchJson('https://example.com/data.json')).resolves.toEqual({ hello: 'world' })
  })

  it('retries a transient 5xx and eventually succeeds', async () => {
    let attempts = 0
    const http = createHttpContext({
      cacheDir,
      maxRetries: 2,
      fetchImpl: fakeFetch((url) => {
        if (url.endsWith('/robots.txt')) return { status: 200, body: '' }
        attempts++
        return attempts < 2 ? { status: 503, body: 'unavailable' } : { status: 200, body: 'recovered' }
      }),
    })
    await expect(http.fetchText('https://example.com/flaky')).resolves.toBe('recovered')
    expect(attempts).toBe(2)
  })

  it('gives up after exhausting retries on a persistent 5xx', async () => {
    const http = createHttpContext({
      cacheDir,
      maxRetries: 1,
      fetchImpl: fakeFetch((url) => (url.endsWith('/robots.txt') ? { status: 200, body: '' } : { status: 500, body: 'down' })),
    })
    await expect(http.fetchText('https://example.com/always-down')).rejects.toThrow()
  })

  it('rate-limits consecutive requests to the same host', async () => {
    // Real timers with a short interval — mixing fake timers with this
    // layer's real fs-based cache I/O is unreliable (the cache reads/writes
    // aren't driven by the timer mock, so fake-timer flushing can race
    // ahead of them). A short real interval keeps this fast and honest.
    const minHostIntervalMs = 150
    const http = createHttpContext({
      cacheDir,
      minHostIntervalMs,
      fetchImpl: fakeFetch((url) => (url.endsWith('/robots.txt') ? { status: 200, body: '' } : { status: 200, body: 'x' })),
    })
    const start = Date.now()
    await http.fetchText('https://ratelimited.example.com/a')
    await http.fetchText('https://ratelimited.example.com/b')
    expect(Date.now() - start).toBeGreaterThanOrEqual(minHostIntervalMs)
  })
})
