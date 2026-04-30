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

const fetchFinnhub = async (symbol) => {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) throw new Error('finnhub: missing api key')

  const to = Math.floor(Date.now() / 1000)
  const from = to - 30 * 24 * 60 * 60
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(
    symbol,
  )}&resolution=60&from=${from}&to=${to}&token=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`finnhub ${res.status}`)
  const data = await res.json()
  if (data?.s !== 'ok') throw new Error(`finnhub: ${data?.s || 'bad response'}`)

  const ts = data.t ?? []
  const bars = []
  for (let i = 0; i < ts.length; i++) {
    const o = data.o?.[i]
    const h = data.h?.[i]
    const l = data.l?.[i]
    const c = data.c?.[i]
    if (o == null || h == null || l == null || c == null) continue
    bars.push({ time: ts[i], open: o, high: h, low: l, close: c })
  }
  if (bars.length === 0) throw new Error('finnhub: no bars')
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
    let bars
    try {
      bars = await fetchFinnhub(symbol)
    } catch (finnhubError) {
      console.warn('stocks-history finnhub failed', finnhubError)
      bars = await fetchYahoo(symbol)
    }
    const payload = { symbol, bars }
    cache.set(symbol, { ts: now, payload })
    return json(200, payload)
  } catch (err) {
    console.error('stocks-history failed', err)
    if (cached) return json(200, cached.payload)
    return json(502, { error: 'upstream failed' })
  }
}
