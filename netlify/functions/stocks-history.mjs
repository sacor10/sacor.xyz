const SYMBOL_RE = /^[A-Z.-]{1,8}$/
const TTL_MS = 5 * 60 * 1000
const cache = new Map()

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

const fetchYahoo = async (symbol) => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=1h&range=1mo`
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`yahoo ${res.status}`)
  const data = await res.json()
  const result = data?.chart?.result?.[0]
  if (!result) throw new Error('yahoo: no result')
  const ts = result.timestamp ?? []
  const q = result.indicators?.quote?.[0] ?? {}
  const bars = []
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i]
    const h = q.high?.[i]
    const l = q.low?.[i]
    const c = q.close?.[i]
    if (o == null || h == null || l == null || c == null) continue
    bars.push({ time: ts[i], open: o, high: h, low: l, close: c })
  }
  return bars
}

export default async (req) => {
  const symbol = (new URL(req.url).searchParams.get('symbol') ?? '').toUpperCase()
  if (!SYMBOL_RE.test(symbol)) return json(400, { error: 'invalid symbol' })

  const now = Date.now()
  const cached = cache.get(symbol)
  if (cached && now - cached.ts < TTL_MS) {
    return json(200, cached.payload)
  }

  try {
    const bars = await fetchYahoo(symbol)
    const payload = { symbol, bars }
    cache.set(symbol, { ts: now, payload })
    return json(200, payload)
  } catch {
    if (cached) return json(200, cached.payload)
    return json(502, { error: 'upstream failed' })
  }
}
