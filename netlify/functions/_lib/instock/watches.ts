import { randomUUID } from 'node:crypto'
import type { AlertConfig, AlertEvent, MatchMode, MatchRule, Watch, WatchStatus } from './types'

export const ALERTS_SCHEMA = 1

/**
 * Poll cadence. Every watch picks a fresh random delay in this window after
 * each check, so a fleet of watches never marches in lockstep against a
 * retailer (and the request pattern does not look like a bot metronome).
 */
export const MIN_INTERVAL_MS = 2 * 60 * 1000
export const MAX_INTERVAL_MS = 5 * 60 * 1000

/** Failed fetches back off instead of hammering a site that is down. */
export const ERROR_BACKOFF_MS = 15 * 60 * 1000
/** One alert per watch per this window, so a flapping page cannot spam. */
export const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000

export const MAX_WATCHES = 20
export const MAX_EVENTS = 25
export const MAX_URL_LENGTH = 500
export const MAX_LABEL_LENGTH = 80
export const MAX_MATCH_TEXT_LENGTH = 200

/** The watch every new account starts with — the reason this page exists. */
export const SEED_WATCH = {
  label: 'Zelda 40th Anniversary Switch 2 Bundle',
  url: 'https://www.nintendo.com/us/store/products/nintendo-switch-2-the-legend-of-zelda-40th-anniversary-edition-121642/',
}

const MATCH_MODES: MatchMode[] = ['auto', 'contains', 'absent']

const PRIVATE_IPV4 =
  /^(?:0|10|127)\.|^169\.254\.|^192\.168\.|^172\.(?:1[6-9]|2\d|3[01])\.|^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./

const isPrivateHost = (host: string): boolean => {
  if (!host) return true
  const bare = host.replace(/^\[|\]$/g, '')
  if (bare === 'localhost' || bare.endsWith('.localhost')) return true
  if (bare.endsWith('.local') || bare.endsWith('.internal') || bare.endsWith('.home.arpa')) return true
  if (bare === '::1' || bare === '::' || bare.startsWith('fe80:') || bare.startsWith('fc') || bare.startsWith('fd')) {
    return true
  }
  if (PRIVATE_IPV4.test(bare)) return true
  // A bare hostname with no dot is an intranet name, not a storefront.
  return !bare.includes('.')
}

/** Validates and canonicalizes a watch URL. Throws with a user-facing message. */
export function normalizeWatchUrl(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) throw new Error('A product URL is required')
  if (raw.length > MAX_URL_LENGTH) throw new Error('That URL is too long')

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Not a valid URL: ${raw}`)
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only http:// and https:// URLs can be watched')
  }
  if (url.username || url.password) throw new Error('URLs with embedded credentials are not allowed')
  if (isPrivateHost(url.hostname.toLowerCase())) {
    throw new Error(`Refusing to watch a private or internal host: ${url.hostname}`)
  }

  url.hash = ''
  return url.toString()
}

const clean = (value: unknown, max: number): string => String(value ?? '').trim().slice(0, max)

const normalizeMatch = (value: unknown): MatchRule => {
  const raw = (value ?? {}) as Partial<MatchRule>
  const mode = MATCH_MODES.includes(raw.mode as MatchMode) ? (raw.mode as MatchMode) : 'auto'
  const text = clean(raw.text, MAX_MATCH_TEXT_LENGTH)
  if (mode !== 'auto' && !text) {
    throw new Error(`A "${mode}" rule needs some text to look for`)
  }
  return { mode, text: mode === 'auto' ? '' : text }
}

const isoOrNull = (value: unknown): string | null => {
  const raw = String(value ?? '')
  return raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : null
}

const STATUSES: WatchStatus[] = ['in_stock', 'out_of_stock', 'unknown', 'error']

/** Random point in the 2–5 minute window, as a delay in ms. */
export const nextCheckDelayMs = (random: () => number = Math.random): number =>
  MIN_INTERVAL_MS + Math.floor(random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS + 1))

export const scheduleNextCheck = (fromMs: number, random: () => number = Math.random): string =>
  new Date(fromMs + nextCheckDelayMs(random)).toISOString()

export const isDue = (watch: Watch, nowMs: number): boolean => {
  if (!watch.enabled) return false
  if (!watch.nextCheckAt) return true
  const due = Date.parse(watch.nextCheckAt)
  return Number.isNaN(due) || due <= nowMs
}

/** Rehydrates one stored watch, filling in anything a older record is missing. */
export function normalizeWatch(value: unknown, nowIso = new Date().toISOString()): Watch {
  const raw = (value ?? {}) as Partial<Watch> & { id?: unknown }
  const url = normalizeWatchUrl(raw.url)
  const id = /^[a-zA-Z0-9_-]{6,64}$/.test(String(raw.id ?? '')) ? String(raw.id) : randomUUID()
  const status = STATUSES.includes(raw.status as WatchStatus) ? (raw.status as WatchStatus) : 'unknown'

  return {
    id,
    label: clean(raw.label, MAX_LABEL_LENGTH) || new URL(url).hostname.replace(/^www\./, ''),
    url,
    enabled: raw.enabled !== false,
    match: normalizeMatch(raw.match),
    notifyEmail: raw.notifyEmail !== false,
    notifySms: raw.notifySms !== false,
    status,
    statusReason: clean(raw.statusReason, 300),
    lastCheckedAt: isoOrNull(raw.lastCheckedAt),
    lastInStockAt: isoOrNull(raw.lastInStockAt),
    lastAlertAt: isoOrNull(raw.lastAlertAt),
    nextCheckAt: isoOrNull(raw.nextCheckAt),
    consecutiveErrors: Number.isInteger(raw.consecutiveErrors) ? Math.max(0, raw.consecutiveErrors as number) : 0,
    createdAt: isoOrNull(raw.createdAt) ?? nowIso,
  }
}

const normalizeEvent = (value: unknown): AlertEvent | null => {
  const raw = (value ?? {}) as Partial<AlertEvent>
  const at = isoOrNull(raw.at)
  if (!at) return null
  return {
    id: String(raw.id ?? randomUUID()),
    watchId: String(raw.watchId ?? ''),
    label: clean(raw.label, MAX_LABEL_LENGTH),
    url: String(raw.url ?? ''),
    at,
    channels: Array.isArray(raw.channels) ? raw.channels.map((c) => String(c)).slice(0, 4) : [],
    detail: clean(raw.detail, 300),
  }
}

export const normalizePhone = (value: unknown): string => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const digits = raw.replace(/[^\d]/g, '')
  if (raw.startsWith('+')) {
    if (digits.length < 8 || digits.length > 15) throw new Error('That phone number does not look valid')
    return `+${digits}`
  }
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  throw new Error('Enter a 10-digit US number, or an international number starting with +')
}

const normalizeEmail = (value: unknown, fallback: string): string => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) || raw.length > 254) {
    throw new Error('That email address does not look valid')
  }
  return raw
}

export function defaultConfig(email: string, nowIso = new Date().toISOString()): AlertConfig {
  return {
    schema: ALERTS_SCHEMA,
    email,
    phone: '',
    carrier: '',
    watches: [normalizeWatch({ ...SEED_WATCH, createdAt: nowIso }, nowIso)],
    events: [],
    updatedAt: null,
  }
}

/**
 * Rebuilds a whole config record. Bad watches are dropped rather than failing
 * the read, so one hand-corrupted entry can never lock a user out of the page.
 */
export function normalizeConfig(value: unknown, fallbackEmail: string): AlertConfig {
  const raw = (value ?? {}) as Partial<AlertConfig>
  const nowIso = new Date().toISOString()
  const watches: Watch[] = []
  const seen = new Set<string>()

  for (const entry of Array.isArray(raw.watches) ? raw.watches : []) {
    if (watches.length >= MAX_WATCHES) break
    let watch: Watch
    try {
      watch = normalizeWatch(entry, nowIso)
    } catch {
      continue
    }
    if (seen.has(watch.id)) continue
    seen.add(watch.id)
    watches.push(watch)
  }

  return {
    schema: ALERTS_SCHEMA,
    email: normalizeEmail(raw.email, fallbackEmail),
    phone: (() => {
      try {
        return normalizePhone(raw.phone)
      } catch {
        return ''
      }
    })(),
    carrier: clean(raw.carrier, 40).toLowerCase(),
    watches,
    events: (Array.isArray(raw.events) ? raw.events : [])
      .map(normalizeEvent)
      .filter((e): e is AlertEvent => e !== null)
      .slice(0, MAX_EVENTS),
    updatedAt: isoOrNull(raw.updatedAt),
  }
}

/**
 * Applies a client-submitted config on top of the stored one. Only the fields
 * a person edits come from the browser; poll bookkeeping (status, schedule,
 * alert history) is server-owned and is carried across by watch id.
 */
export function mergeSubmittedConfig(current: AlertConfig, submitted: unknown, fallbackEmail: string): AlertConfig {
  const raw = (submitted ?? {}) as Partial<AlertConfig>
  if (!Array.isArray(raw.watches)) throw new Error('watches must be an array')
  if (raw.watches.length > MAX_WATCHES) throw new Error(`You can watch up to ${MAX_WATCHES} pages`)

  const byId = new Map(current.watches.map((watch) => [watch.id, watch]))
  const nowIso = new Date().toISOString()
  const watches: Watch[] = []
  const seenIds = new Set<string>()
  const seenUrls = new Set<string>()

  for (const entry of raw.watches) {
    const incoming = (entry ?? {}) as Partial<Watch>
    const url = normalizeWatchUrl(incoming.url)
    if (seenUrls.has(url)) throw new Error(`That page is already on the list: ${url}`)
    seenUrls.add(url)

    const existing = byId.get(String(incoming.id ?? ''))
    // Re-pointing a watch at a different page invalidates its stock history.
    const carry = existing && existing.url === url ? existing : null

    const watch = normalizeWatch(
      {
        ...(carry ?? {}),
        id: existing?.id,
        label: incoming.label,
        url,
        enabled: incoming.enabled,
        match: incoming.match,
        notifyEmail: incoming.notifyEmail,
        notifySms: incoming.notifySms,
        createdAt: existing?.createdAt ?? nowIso,
      },
      nowIso,
    )

    if (!carry) {
      watch.status = 'unknown'
      watch.statusReason = 'Not checked yet'
      watch.lastCheckedAt = null
      watch.lastInStockAt = null
      watch.lastAlertAt = null
      watch.consecutiveErrors = 0
      watch.nextCheckAt = null
    }

    if (seenIds.has(watch.id)) throw new Error('Duplicate watch id in request')
    seenIds.add(watch.id)
    watches.push(watch)
  }

  return {
    schema: ALERTS_SCHEMA,
    email: normalizeEmail(raw.email, fallbackEmail),
    phone: normalizePhone(raw.phone),
    carrier: clean(raw.carrier, 40).toLowerCase(),
    watches,
    events: current.events,
    updatedAt: nowIso,
  }
}

export function recordEvent(config: AlertConfig, event: AlertEvent): AlertConfig {
  return { ...config, events: [event, ...config.events].slice(0, MAX_EVENTS) }
}
