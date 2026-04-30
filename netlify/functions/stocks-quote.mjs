const SYMBOL_RE = /^[A-Z.-]{1,8}$/
const DEBOUNCE_MS = 1000
const FETCH_TIMEOUT_MS = 8000
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

const assertUsablePrice = (price, provider) => {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    throw new UpstreamError(provider, 'no usable price')
  }
}

const fetchFinnhubQuote = async (symbol) => {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) throw new UpstreamError('finnhub', 'missing api key')

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`
  const res = await withTimeout(url)
  if (!res.ok) throw new UpstreamError('finnhub', `http ${res.status}`, res.status)

  const data = await res.json()
  assertUsablePrice(data?.c, 'finnhub')

  return {
    symbol,
    price: data.c,
    change: data.d ?? 0,
    changePct: data.dp ?? 0,
    ts: data.t || Math.floor(Date.now() / 1000),
  }
}

const fetchYahooQuote = async (symbol) => {
  const encodedSymbol = encodeURIComponent(symbol)
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=1m&range=1d`
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
  const result = data?.chart?.result?.[0]
  if (!result) {
    const description = data?.chart?.error?.description || 'no result'
    throw new UpstreamError('yahoo', description)
  }

  const closes = result.indicators?.quote?.[0]?.close ?? []
  const timestamps = result.timestamp ?? []
  const lastCloseIndex = closes.findLastIndex((close) => typeof close === 'number')
  const meta = result.meta ?? {}
  const price =
    typeof meta.regularMarketPrice === 'number'
      ? meta.regularMarketPrice
      : closes[lastCloseIndex]
  assertUsablePrice(price, 'yahoo')

  const previousClose =
    typeof meta.chartPreviousClose === 'number'
      ? meta.chartPreviousClose
      : typeof meta.previousClose === 'number'
        ? meta.previousClose
        : null
  const change = previousClose ? price - previousClose : 0
  const changePct = previousClose ? (change / previousClose) * 100 : 0

  return {
    symbol,
    price,
    change,
    changePct,
    ts: timestamps[lastCloseIndex] ?? Math.floor(Date.now() / 1000),
  }
}

const fetchQuote = async (symbol) => {
  const attempts = [
    ...(process.env.FINNHUB_API_KEY ? [() => fetchFinnhubQuote(symbol)] : []),
    () => fetchYahooQuote(symbol),
  ]
  const errors = []

  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch (err) {
      console.warn('stocks-quote provider failed', err)
      errors.push({
        provider: err.provider || 'unknown',
        message: err.message || 'failed',
        ...(err.status ? { status: err.status } : {}),
      })
    }
  }

  const err = new UpstreamError('stocks-quote', 'all providers failed')
  err.errors = errors
  throw err
}

export default async (req) => {
  const symbol = (new URL(req.url).searchParams.get('symbol') ?? '').toUpperCase()
  if (!SYMBOL_RE.test(symbol)) return json(400, { error: 'invalid symbol' })

  const now = Date.now()
  const last = lastFetch.get(symbol) ?? 0
  if (now - last < DEBOUNCE_MS) {
    const cached = lastPayload.get(symbol)
    if (cached) return json(200, cached)
  }
  lastFetch.set(symbol, now)

  try {
    const payload = await fetchQuote(symbol)
    lastPayload.set(symbol, payload)
    return json(200, payload)
  } catch (err) {
    console.error('stocks-quote failed', err)
    return json(502, { error: 'upstream failed', providers: err.errors ?? [] })
  }
}
