// The shared, polite HTTP layer every Pay Index adapter is required to use
// instead of calling fetch() directly. This is where "source hygiene" from
// the spec becomes code rather than a promise:
//   - refuses to request a government host at all (methodology rule 9)
//   - honors robots.txt (best-effort parser, longest-match on the '*' block)
//   - rate-limits per host so ingestion never hammers a source
//   - caches responses to disk so a resumed/retried ingest run costs zero
//     extra requests for anything already fetched this period
//   - retries transient failures with backoff
//   - sends a descriptive, honest User-Agent

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isGovernmentUrl } from './govHosts.ts'
import { PayIndexError } from './errors.ts'

export const PAY_INDEX_USER_AGENT =
  'sacor.xyz-pay-index/1.0 (+https://sacor.xyz/pay-index; monthly wage-tracker research bot)'

const DEFAULT_CACHE_DIR = path.join('.data', 'pay-index-cache')
const DEFAULT_MIN_HOST_INTERVAL_MS = 1200
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_MAX_RETRIES = 2

interface RobotsRules {
  disallow: string[]
}

function parseRobots(text: string): RobotsRules {
  type Block = { agents: string[]; disallow: string[] }
  const blocks: Block[] = []
  let current: Block | null = null

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const sep = line.indexOf(':')
    if (sep === -1) continue
    const key = line.slice(0, sep).trim().toLowerCase()
    const value = line.slice(sep + 1).trim()

    if (key === 'user-agent') {
      if (!current || current.disallow.length > 0) {
        current = { agents: [], disallow: [] }
        blocks.push(current)
      }
      current.agents.push(value.toLowerCase())
    } else if (key === 'disallow' && current) {
      if (value) current.disallow.push(value)
    }
  }

  const wildcard = blocks.find((b) => b.agents.includes('*'))
  return { disallow: wildcard?.disallow ?? [] }
}

async function getRobotsRules(
  origin: string,
  rawFetch: typeof fetch,
  userAgent: string,
  cache: Map<string, Promise<RobotsRules>>,
): Promise<RobotsRules> {
  let promise = cache.get(origin)
  if (!promise) {
    promise = (async () => {
      try {
        const res = await rawFetch(`${origin}/robots.txt`, { headers: { 'User-Agent': userAgent } })
        if (!res.ok) return { disallow: [] }
        return parseRobots(await res.text())
      } catch {
        // Can't read robots.txt at all (network hiccup, no robots.txt route
        // that resolves) — fail open, matching standard crawler behavior:
        // absence of a readable robots.txt is not a disallow signal.
        return { disallow: [] }
      }
    })()
    cache.set(origin, promise)
  }
  return promise
}

function isDisallowedByRobots(pathname: string, rules: RobotsRules): boolean {
  return rules.disallow.some((prefix) => prefix && pathname.startsWith(prefix))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface HttpContextOptions {
  readonly cacheDir?: string
  readonly minHostIntervalMs?: number
  readonly cacheTtlMs?: number
  readonly maxRetries?: number
  readonly userAgent?: string
  // Injectable for tests — never used to bypass rate limiting/robots/gov
  // checks, only to avoid a real network call.
  readonly fetchImpl?: typeof fetch
}

export interface HttpContext {
  fetchText(url: string, init?: RequestInit): Promise<string>
  fetchJson<T>(url: string, init?: RequestInit): Promise<T>
}

async function readCache(cacheDir: string, key: string, ttlMs: number): Promise<string | null> {
  try {
    const raw = await readFile(path.join(cacheDir, `${key}.json`), 'utf8')
    const entry = JSON.parse(raw) as { body: string; cachedAt: number }
    if (Date.now() - entry.cachedAt > ttlMs) return null
    return entry.body
  } catch {
    return null
  }
}

async function writeCache(cacheDir: string, key: string, body: string): Promise<void> {
  await mkdir(cacheDir, { recursive: true })
  await writeFile(path.join(cacheDir, `${key}.json`), JSON.stringify({ body, cachedAt: Date.now() }), 'utf8')
}

export function createHttpContext(options: HttpContextOptions = {}): HttpContext {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR
  const minHostIntervalMs = options.minHostIntervalMs ?? DEFAULT_MIN_HOST_INTERVAL_MS
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const userAgent = options.userAgent ?? PAY_INDEX_USER_AGENT
  const rawFetch = options.fetchImpl ?? fetch
  // Scoped to this context instance, not module-level — so tests (and any
  // two independently configured contexts) never share cached robots
  // rules or rate-limit timers across different fetchImpl injections.
  const robotsCache = new Map<string, Promise<RobotsRules>>()
  const lastRequestAtByHost = new Map<string, number>()

  async function politeFetch(url: string, init?: RequestInit): Promise<string> {
    if (isGovernmentUrl(url)) {
      throw new PayIndexError(
        'government_source_blocked',
        `Refusing to fetch ${url}: government hosts are excluded from the Pay Index by methodology rule 9.`,
        400,
      )
    }

    const parsed = new URL(url)
    const origin = parsed.origin
    // Include the body in the cache key — POST requests (e.g. Workday's
    // search endpoint) reuse one URL for many different queries, and
    // without this a second query would wrongly return the first query's
    // cached response.
    const bodyPart = typeof init?.body === 'string' ? init.body : ''
    const cacheKey = createHash('sha256').update(`${init?.method ?? 'GET'} ${url}\n${bodyPart}`).digest('hex')

    const cached = await readCache(cacheDir, cacheKey, cacheTtlMs)
    if (cached !== null) return cached

    const robots = await getRobotsRules(origin, rawFetch, userAgent, robotsCache)
    if (isDisallowedByRobots(parsed.pathname, robots)) {
      throw new PayIndexError('robots_disallowed', `Refusing to fetch ${url}: disallowed by ${origin}/robots.txt`, 400)
    }

    const lastAt = lastRequestAtByHost.get(origin) ?? 0
    const wait = minHostIntervalMs - (Date.now() - lastAt)
    if (wait > 0) await sleep(wait)
    lastRequestAtByHost.set(origin, Date.now())

    let lastError: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await rawFetch(url, {
          ...init,
          headers: { 'User-Agent': userAgent, ...init?.headers },
        })
        if (!res.ok) {
          if (res.status >= 500 && attempt < maxRetries) {
            await sleep(2 ** attempt * 500)
            continue
          }
          throw new PayIndexError('upstream_http_error', `${url} responded ${res.status}`, 502)
        }
        const body = await res.text()
        await writeCache(cacheDir, cacheKey, body)
        return body
      } catch (err) {
        lastError = err
        if (err instanceof PayIndexError) throw err
        if (attempt < maxRetries) {
          await sleep(2 ** attempt * 500)
          continue
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}`)
  }

  return {
    fetchText: politeFetch,
    async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
      const text = await politeFetch(url, init)
      return JSON.parse(text) as T
    },
  }
}
