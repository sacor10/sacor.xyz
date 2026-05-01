const GEOCODE_FN = '/.netlify/functions/geocode'

/**
 * @param {string} query
 * @param {{ signal?: AbortSignal, limit?: number }} [options]
 * @returns {Promise<{ results: Array<{ id: string, name: string, lat: number, lng: number, type: string, address: string }> }>}
 */
export async function searchPlaces(query, { signal, limit = 5 } = {}) {
  const trimmed = String(query ?? '').trim()
  if (!trimmed) {
    return { results: [] }
  }

  const params = new URLSearchParams({ q: trimmed })
  if (Number.isFinite(limit)) {
    params.set('limit', String(Math.min(10, Math.max(1, Math.trunc(Number(limit))))))
  }

  const res = await fetch(`${GEOCODE_FN}?${params}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  let payload = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok) {
    const msg =
      (payload && typeof payload.error === 'string' && payload.error) ||
      `Place search failed (${res.status})`
    throw new Error(msg)
  }

  const results = Array.isArray(payload?.results) ? payload.results : []
  return { results }
}
