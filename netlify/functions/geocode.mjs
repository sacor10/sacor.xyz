import { getStore } from '@netlify/blobs'
import { requireTravelAccess, userHash } from './_lib/session.mjs'

/**
 * Proxies travel stop place search via Google Places API (New) Text Search.
 * @see https://developers.google.com/maps/documentation/places/web-service/text-search
 *
 * Places is billed per request, and the only legitimate caller is the
 * login-gated Travel Plans editor. To keep the endpoint from being scripted
 * into an unbounded Google bill we layer three abuse controls onto the proxy:
 *   1. require a valid signed-in session (blocks anonymous spam);
 *   2. rate-limit per user via Netlify Blobs (caps a runaway/stolen session);
 *   3. cache identical recent queries so duplicates don't cost money.
 */
const PLACES_SEARCH_TEXT = 'https://places.googleapis.com/v1/places:searchText'
/** Text Search Essentials (id + name resources) + Pro fields we need — see FieldMask SKU table in docs */
const FIELD_MASK =
  'places.id,places.displayName,places.location,places.formattedAddress,places.primaryType,places.types'
const MAX_QUERY_LEN = 200
const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10
/** Matches other JSON proxies (stocks-quote); prevents CDN/browser serving one response for many queries */
const CACHE_CONTROL_JSON = 'no-store'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': CACHE_CONTROL_JSON,
    },
  })

// --- Abuse controls -------------------------------------------------------

/** Per-user daily cap; building an itinerary is at most a few dozen searches. */
const DAILY_LIMIT = 300
/** Short burst guard to blunt a script reusing a single stolen session. */
const PER_MINUTE_LIMIT = 30
const RATE_STORE = 'geocode'

/** In-memory dedup cache (best-effort; instances are ephemeral, like stocks-quote.mjs). */
const CACHE_TTL_MS = 60_000
const MAX_CACHE_ENTRIES = 500
const responseCache = new Map()

const dayKey = () => new Date().toISOString().slice(0, 10)
const minuteKey = () => new Date().toISOString().slice(0, 16)

const loadJson = async (store, key, fallback) => {
  const raw = await store.get(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}
const saveJson = (store, key, value) => store.set(key, JSON.stringify(value))

const dailyRateKey = (hash, day) => `rate/geocode/day/${day}/${hash}`
const minuteRateKey = (hash, minute) => `rate/geocode/min/${minute}/${hash}`

/** Increment a Blobs counter; returns false once the limit is reached. */
async function bumpCounter(store, key, limit) {
  const current = await loadJson(store, key, { count: 0 })
  const count = Number(current?.count || 0)
  if (count >= limit) return false
  await saveJson(store, key, { count: count + 1, updatedAt: new Date().toISOString() })
  return true
}

/** Per-user minute + daily caps. Mirrors checkRateLimit in stumble-submissions.mjs. */
async function withinRateLimit(hash) {
  const store = getStore(RATE_STORE)
  if (!(await bumpCounter(store, minuteRateKey(hash, minuteKey()), PER_MINUTE_LIMIT))) return false
  if (!(await bumpCounter(store, dailyRateKey(hash, dayKey()), DAILY_LIMIT))) return false
  return true
}

const cacheKeyFor = (q, limit, languageCode) => `${q.toLowerCase()}|${limit}|${languageCode}`

const readCache = (key) => {
  const hit = responseCache.get(key)
  if (!hit) return null
  if (hit.expires < Date.now()) {
    responseCache.delete(key)
    return null
  }
  return hit.data
}

const writeCache = (key, data) => {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next().value
    if (oldest !== undefined) responseCache.delete(oldest)
  }
  responseCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
}

/**
 * Incoming Request URLs can be relative; without a base URL, query params are lost → same results for every query.
 */
const requestSearchParams = (req) => {
  const raw = typeof req.url === 'string' ? req.url : ''
  try {
    return new URL(raw).searchParams
  } catch {
    const host = typeof req.headers.get === 'function' ? req.headers.get('host') || 'localhost' : 'localhost'
    const protoHdr =
      typeof req.headers.get === 'function'
        ? req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || ''
        : ''
    const proto = /^https?$/i.test(protoHdr) ? protoHdr.toLowerCase() : 'https'
    return new URL(raw, `${proto}://${host}`).searchParams
  }
}

/** First language tag from Accept-Language suitable for Places languageCode */
const languageFromAccept = (hdr) => {
  if (!hdr || typeof hdr !== 'string') return ''
  const first = hdr.split(',')[0].trim().split(';')[0].trim()
  return /^[a-zA-Z]{2}([-a-zA-Z0-9]{1,12})?$/.test(first) ? first : ''
}

const placeIdStr = (place) => {
  if (typeof place?.id === 'string' && place.id.trim()) return place.id.trim()
  const name = typeof place?.name === 'string' ? place.name : ''
  const m = name.match(/^places\/(.+)$/)
  return (m?.[1] || name || '').trim() || null
}

const slimPlaceResult = (place) => {
  const lat = Number(place?.location?.latitude)
  const lng = Number(place?.location?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const id = placeIdStr(place)
  if (!id) return null
  const rawName =
    typeof place.displayName?.text === 'string' ? place.displayName.text.trim() : ''
  const name = rawName || 'Place'
  const address =
    typeof place.formattedAddress === 'string' ? place.formattedAddress.trim() : ''
  const primary =
    typeof place.primaryType === 'string' ? place.primaryType.trim() : ''
  const types0 = Array.isArray(place.types) && typeof place.types[0] === 'string'
    ? place.types[0].trim()
    : ''
  const type = primary || types0
  return { id, name, lat, lng, type, address }
}

async function geocodePlaces({ q, limit, apiKey, languageCode }) {
  const body = {
    textQuery: q,
    pageSize: limit,
  }
  if (languageCode) body.languageCode = languageCode

  const upstreamRes = await fetch(PLACES_SEARCH_TEXT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  })

  const payload = await upstreamRes.json().catch(() => null)

  if (!upstreamRes.ok) {
    const msg =
      payload?.error?.message ||
      payload?.error?.status ||
      (typeof payload?.error === 'string' ? payload.error : null) ||
      `Places returned ${upstreamRes.status}`
    const status = upstreamRes.status === 400 ? 502 : upstreamRes.status >= 500 ? 502 : 502
    return {
      errorResponse: json({ error: 'Place search failed', detail: String(msg).slice(0, 400) }, status),
    }
  }

  const places = Array.isArray(payload?.places) ? payload.places : []
  const results = places.map(slimPlaceResult).filter(Boolean)
  return { data: { results } }
}

export default async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // Layer 1: require a signed-in session. The only legitimate caller is the
  // login-gated Travel Plans editor, so anonymous requests are abuse.
  let session
  try {
    const auth = requireTravelAccess(req)
    if (auth.error) {
      const status = auth.error.status || 401
      return json(
        { error: status === 403 ? 'Your account cannot search places.' : 'Sign in to search places.' },
        status,
      )
    }
    session = auth.session
  } catch {
    // Missing/short SESSION_SECRET makes auth unverifiable — treat as misconfig.
    return json({ error: 'Place search is not configured.' }, 503)
  }

  let q = ''
  let requested = NaN

  if (req.method === 'POST') {
    let payload
    try {
      payload = await req.json()
    } catch {
      return json({ error: 'Request body must be JSON.' }, 400)
    }
    const rawQ = typeof payload?.q === 'string' ? payload.q : ''
    q = rawQ.trim()
    requested = Number(payload?.limit)
  } else {
    const params = requestSearchParams(req)
    const qRaw = typeof params.get('q') === 'string' ? params.get('q') : ''
    q = qRaw.trim()
    requested = Number(params.get('limit'))
  }

  const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || '').trim()
  if (!apiKey) {
    return json(
      { error: 'Place search is not configured (missing GOOGLE_PLACES_API_KEY).' },
      503,
    )
  }

  if (!q) {
    return json({ error: 'Query "q" is required.' }, 400)
  }
  if (q.length > MAX_QUERY_LEN) {
    return json({ error: `Query must be at most ${MAX_QUERY_LEN} characters.` }, 400)
  }

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.isFinite(requested) ? Math.trunc(requested) : DEFAULT_LIMIT),
  )

  const acceptLang = typeof req.headers.get === 'function' ? req.headers.get('accept-language') : ''
  const languageCode = languageFromAccept(acceptLang)

  // Layer 3: serve identical recent queries from cache before spending money.
  const cacheKey = cacheKeyFor(q, limit, languageCode)
  const cached = readCache(cacheKey)
  if (cached) return json(cached)

  // Layer 2: per-user rate limit. Only cache misses (real Google calls) count.
  // Fail open on a Blobs hiccup rather than blocking a legitimate signed-in user;
  // the auth gate above is still the primary defense against abuse.
  let allowed = true
  try {
    allowed = await withinRateLimit(`user-${userHash(session.email)}`)
  } catch (err) {
    console.warn('geocode rate-limit check failed', err)
  }
  if (!allowed) {
    return json({ error: 'Search limit reached. Try again later.' }, 429)
  }

  try {
    const { data, errorResponse } = await geocodePlaces({ q, limit, apiKey, languageCode })
    if (errorResponse) return errorResponse
    writeCache(cacheKey, data)
    return json(data)
  } catch (err) {
    return json(
      { error: 'Place search request failed', detail: err instanceof Error ? err.message : String(err) },
      502,
    )
  }
}
