/**
 * Proxies travel stop place search via Google Places API (New) Text Search.
 * @see https://developers.google.com/maps/documentation/places/web-service/text-search
 */
const PLACES_SEARCH_TEXT = 'https://places.googleapis.com/v1/places:searchText'
/** Text Search Essentials (id + name resources) + Pro fields we need — see FieldMask SKU table in docs */
const FIELD_MASK =
  'places.id,places.displayName,places.location,places.formattedAddress,places.primaryType,places.types'
const MAX_QUERY_LEN = 200
const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10
/** Places content: avoid long public caching per Maps platform policies */
const CACHE_CONTROL_JSON = 'private, max-age=120'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': CACHE_CONTROL_JSON,
    },
  })

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
    return json({ error: 'Place search failed', detail: String(msg).slice(0, 400) }, status)
  }

  const places = Array.isArray(payload?.places) ? payload.places : []
  const results = places.map(slimPlaceResult).filter(Boolean)
  return json({ results })
}

export default async (req) => {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || '').trim()
  if (!apiKey) {
    return json(
      { error: 'Place search is not configured (missing GOOGLE_PLACES_API_KEY).' },
      503,
    )
  }

  const url = new URL(req.url)
  const qRaw = typeof url.searchParams.get('q') === 'string' ? url.searchParams.get('q') : ''
  const q = qRaw.trim()
  if (!q) {
    return json({ error: 'Query parameter "q" is required.' }, 400)
  }
  if (q.length > MAX_QUERY_LEN) {
    return json({ error: `Query must be at most ${MAX_QUERY_LEN} characters.` }, 400)
  }

  const limitNum = Number(url.searchParams.get('limit'))
  const requested = Number.isFinite(limitNum) ? Math.trunc(limitNum) : DEFAULT_LIMIT
  const limit = Math.min(MAX_LIMIT, Math.max(1, requested))

  const acceptLang = typeof req.headers.get === 'function' ? req.headers.get('accept-language') : ''
  const languageCode = languageFromAccept(acceptLang)

  try {
    return await geocodePlaces({ q, limit, apiKey, languageCode })
  } catch (err) {
    return json(
      { error: 'Place search request failed', detail: err instanceof Error ? err.message : String(err) },
      502,
    )
  }
}
