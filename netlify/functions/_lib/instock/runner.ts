import { detectAvailability } from './detect'
import {
  ALERT_COOLDOWN_MS,
  ERROR_BACKOFF_MS,
  normalizeWatchUrl,
  scheduleNextCheck,
} from './watches'
import type { DetectionResult, Watch } from './types'

/**
 * Fetching a product page and turning the result into an updated watch.
 * Kept free of Blobs and Resend so the whole decision path is unit-testable.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const FETCH_TIMEOUT_MS = 15_000
const MAX_BYTES = 2 * 1024 * 1024
const MAX_REDIRECTS = 5

/**
 * Follows redirects by hand so every hop is re-validated: an open redirect on
 * a storefront must not become a way to make this function fetch an internal
 * address on our behalf.
 */
export async function fetchPageHtml(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string> {
  let current = normalizeWatchUrl(url)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    })

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) throw new Error(`HTTP ${res.status} with no redirect target`)
      current = normalizeWatchUrl(new URL(location, current).toString())
      continue
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await readCapped(res)
  }

  throw new Error('Too many redirects')
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return await res.text()

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let html = ''
  let bytes = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      html += decoder.decode(value, { stream: true })
      if (bytes >= MAX_BYTES) break
    }
  } finally {
    await reader.cancel().catch(() => {})
  }

  return html + decoder.decode()
}

export interface CheckOutcome {
  watch: Watch
  detection: DetectionResult | null
  error: string | null
  /** True when this check flipped the page into stock and no cooldown applies. */
  shouldAlert: boolean
}

export interface CheckOptions {
  now?: number
  random?: () => number
  fetchHtml?: (url: string) => Promise<string>
}

export async function checkWatch(watch: Watch, options: CheckOptions = {}): Promise<CheckOutcome> {
  const now = options.now ?? Date.now()
  const random = options.random ?? Math.random
  const fetchHtml = options.fetchHtml ?? fetchPageHtml
  const nowIso = new Date(now).toISOString()

  let detection: DetectionResult
  try {
    detection = detectAvailability(await fetchHtml(watch.url), watch.match, watch.url)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const consecutiveErrors = watch.consecutiveErrors + 1
    return {
      watch: {
        ...watch,
        status: 'error',
        statusReason: `Check failed: ${message}`.slice(0, 300),
        lastCheckedAt: nowIso,
        consecutiveErrors,
        // Back off further the longer a site keeps failing, up to ~1 hour.
        nextCheckAt: new Date(now + Math.min(consecutiveErrors, 4) * ERROR_BACKOFF_MS).toISOString(),
      },
      detection: null,
      error: message,
      shouldAlert: false,
    }
  }

  const becameAvailable = detection.status === 'in_stock' && watch.status !== 'in_stock'
  const lastAlertMs = watch.lastAlertAt ? Date.parse(watch.lastAlertAt) : NaN
  const cooling = Number.isFinite(lastAlertMs) && now - lastAlertMs < ALERT_COOLDOWN_MS

  return {
    watch: {
      ...watch,
      status: detection.status,
      statusReason: detection.reason.slice(0, 300),
      lastCheckedAt: nowIso,
      lastInStockAt: detection.status === 'in_stock' ? nowIso : watch.lastInStockAt,
      consecutiveErrors: 0,
      nextCheckAt: scheduleNextCheck(now, random),
    },
    detection,
    error: null,
    shouldAlert: becameAvailable && !cooling,
  }
}
