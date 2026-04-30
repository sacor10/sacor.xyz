const SYMBOL_RE = /^[A-Z.=-]{1,8}$/
const TTL_MS = 5 * 60 * 1000
const FETCH_TIMEOUT_MS = 8000
const cache = new Map()

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

class UpstreamError extends Error {
  constructor(provider, message, status) {
    super(`${provider}: ${message}`)
    this.provider = provider
    this.status = status
  }
}

const withTimeout = async (url, options = {}) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

const parseYahooBars = (data) => {
  const result = data?.chart?.result?.[0]
  if (!result) {
    const description = data?.chart?.error?.description || 'no result'
    throw new UpstreamError('yahoo', description)
  }

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

  if (bars.length === 0) throw new UpstreamError('yahoo', 'no bars')
  return bars
}

const fetchYahoo = async (symbol, host) => {
  const encodedSymbol = encodeURIComponent(symbol)
  const now = Math.floor(Date.now() / 1000)
  const oneMonthAgo = now - 30 * 24 * 60 * 60
  const url = `https://${host}/v8/finance/chart/${encodedSymbol}?interval=1h&period1=${oneMonthAgo}&period2=${now}`
  const res = await withTimeout(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://finance.yahoo.com/',
    },
  })
  if (!res.ok) throw new UpstreamError('yahoo', `http ${res.status}`, res.status)
  const data = await res.json()
  return parseYahooBars(data)
}

const fetchFinnhub = async (symbol) => {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) throw new UpstreamError('finnhub', 'missing api key')

  const to = Math.floor(Date.now() / 1000)
  const from = to - 30 * 24 * 60 * 60
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(
    symbol,
  )}&resolution=60&from=${from}&to=${to}&token=${encodeURIComponent(apiKey)}`
  const res = await withTimeout(url)
  if (!res.ok) throw new UpstreamError('finnhub', `http ${res.status}`, res.status)
  const data = await res.json()
  if (data?.s !== 'ok') {
    throw new UpstreamError('finnhub', data?.s || data?.error || 'bad response')
  }

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
  if (bars.length === 0) throw new UpstreamError('finnhub', 'no bars')
  return bars
}

const fetchHistory = async (symbol) => {
  const attempts = [
    () => fetchYahoo(symbol, 'query2.finance.yahoo.com'),
    () => fetchYahoo(symbol, 'query1.finance.yahoo.com'),
    () => fetchFinnhub(symbol),
  ]
  const errors = []

  for (const attempt of attempts) {
    try {
      return { bars: await attempt(), errors }
    } catch (err) {
      console.warn('stocks-history provider failed', err)
      errors.push({
        provider: err.provider || 'unknown',
        message: err.message || 'failed',
        ...(err.status ? { status: err.status } : {}),
      })
    }
  }

  const err = new UpstreamError('stocks-history', 'all providers failed')
  err.errors = errors
  throw err
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
    const { bars } = await fetchHistory(symbol)
    const payload = { symbol, bars }
    cache.set(symbol, { ts: now, payload })
    return json(200, payload)
  } catch (err) {
    console.error('stocks-history failed', err)
    if (cached) return json(200, cached.payload)
    return json(502, { error: 'upstream failed', providers: err.errors ?? [] })
  }
}
