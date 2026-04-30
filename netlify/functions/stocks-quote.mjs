const SYMBOL_RE = /^[A-Z.-]{1,8}$/
const DEBOUNCE_MS = 1000
const lastFetch = new Map()
const lastPayload = new Map()

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

export default async (req) => {
  const symbol = (new URL(req.url).searchParams.get('symbol') ?? '').toUpperCase()
  if (!SYMBOL_RE.test(symbol)) return json(400, { error: 'invalid symbol' })

  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return json(500, { error: 'missing api key' })

  const now = Date.now()
  const last = lastFetch.get(symbol) ?? 0
  if (now - last < DEBOUNCE_MS) {
    const cached = lastPayload.get(symbol)
    if (cached) return json(200, cached)
  }
  lastFetch.set(symbol, now)

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`
    const res = await fetch(url)
    if (!res.ok) return json(502, { error: 'upstream failed' })
    const data = await res.json()
    if (typeof data?.c !== 'number') return json(502, { error: 'upstream failed' })
    const payload = {
      symbol,
      price: data.c,
      change: data.d ?? 0,
      changePct: data.dp ?? 0,
      ts: data.t ?? Math.floor(now / 1000),
    }
    lastPayload.set(symbol, payload)
    return json(200, payload)
  } catch {
    return json(502, { error: 'upstream failed' })
  }
}
