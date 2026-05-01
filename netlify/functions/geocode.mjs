const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'sacor.xyz travel-planner (https://sacor.xyz)'
const MAX_QUERY_LEN = 200
const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
    },
  })

const pickName = (entry) => {
  if (typeof entry?.name === 'string' && entry.name.trim()) return entry.name.trim()
  const dn = typeof entry?.display_name === 'string' ? entry.display_name : ''
  const first = dn.split(',')[0]?.trim()
  return first || 'Place'
}

const slimResult = (entry) => {
  const lat = Number(entry.lat)
  const lng = Number(entry.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const name = pickName(entry)
  const address = typeof entry.display_name === 'string' ? entry.display_name.trim() : ''
  const placeId =
    entry.place_id != null ? entry.place_id : entry.osm_id != null ? `osm_${entry.osm_id}` : `${lat},${lng}`
  return {
    id: String(placeId),
    name,
    lat,
    lng,
    type: typeof entry.type === 'string' ? entry.type : '',
    address,
  }
}

export default async (req) => {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
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
  const requested = Number.isFinite(limitNum)
    ? Math.trunc(limitNum)
    : DEFAULT_LIMIT
  const limit = Math.min(MAX_LIMIT, Math.max(1, requested))

  const nominatim = new URL(NOMINATIM_SEARCH)
  nominatim.searchParams.set('format', 'jsonv2')
  nominatim.searchParams.set('addressdetails', '1')
  nominatim.searchParams.set('limit', String(limit))
  nominatim.searchParams.set('q', q)

  const acceptLang = typeof req.headers.get === 'function' ? req.headers.get('accept-language') : null

  let upstreamRes
  try {
    upstreamRes = await fetch(nominatim, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...(acceptLang ? { 'Accept-Language': acceptLang } : {}),
      },
    })
  } catch (err) {
    return json(
      { error: 'Geocoder request failed', detail: err instanceof Error ? err.message : String(err) },
      502,
    )
  }

  if (!upstreamRes.ok) {
    return json({ error: 'Geocoder returned an error', status: upstreamRes.status }, 502)
  }

  let data
  try {
    data = await upstreamRes.json()
  } catch {
    return json({ error: 'Geocoder returned invalid JSON' }, 502)
  }

  if (!Array.isArray(data)) {
    return json({ error: 'Geocoder returned unexpected payload' }, 502)
  }

  const results = data.map(slimResult).filter(Boolean)
  return json({ results })
}
