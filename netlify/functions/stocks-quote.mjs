const SYMBOL_RE = /^[A-Z.=-]{1,8}$/
const DEBOUNCE_MS = 1000
const lastFetch = new Map()
const lastPayload = new Map()

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://finance.yahoo.com/',
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

const fetchYahooQuote = async (symbol) => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`
  const res = await fetch(url, { headers: YAHOO_HEADERS })
  if (!res.ok) throw new Error(`yahoo http ${res.status}`)
  const data = await res.json()
  const meta = data?.chart?.result?.[0]?.meta
  if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error('yahoo: no price')
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice
  const change = meta.regularMarketPrice - prev
  const changePct = prev !== 0 ? (change / prev) * 100 : 0
  return {
    price: meta.regularMarketPrice,
    change,
    changePct,
    ts: meta.regularMarketTime ?? Math.floor(Date.now() / 1000),
  }
}

// Handles crypto pairs like BTC-USD → BTCUSDT on Binance public API (no auth)
const fetchBinanceQuote = async (symbol) => {
  if (!symbol.endsWith('-USD')) throw new Error('not a USD pair')
  const binancePair = symbol.replace('-USD', 'USDT')
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(binancePair)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`binance http ${res.status}`)
  const data = await res.json()
  const price = parseFloat(data.lastPrice)
  const prev = parseFloat(data.prevClosePrice)
  if (!Number.isFinite(price) || price === 0) throw new Error('binance: no price')
  const change = price - prev
  const changePct = prev !== 0 ? (change / prev) * 100 : 0
  return {
    price,
    change,
    changePct,
    ts: Math.floor((data.closeTime ?? Date.now()) / 1000),
  }
}

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
    if (!res.ok) throw new Error(`finnhub http ${res.status}`)
    const data = await res.json()

    // Finnhub returns c=0 for unsupported symbols (e.g. crypto, futures) — fall through to Yahoo
    if (typeof data?.c === 'number' && data.c !== 0) {
      const payload = {
        symbol,
        price: data.c,
        change: data.d ?? 0,
        changePct: data.dp ?? 0,
        ts: data.t ?? Math.floor(now / 1000),
      }
      lastPayload.set(symbol, payload)
      return json(200, payload)
    }
  } catch {
    // fall through to Yahoo
  }

  try {
    const yq = await fetchYahooQuote(symbol)
    const payload = { symbol, ...yq }
    lastPayload.set(symbol, payload)
    return json(200, payload)
  } catch {
    // fall through to Binance for crypto
  }

  try {
    const bq = await fetchBinanceQuote(symbol)
    const payload = { symbol, ...bq }
    lastPayload.set(symbol, payload)
    return json(200, payload)
  } catch {
    return json(502, { error: 'upstream failed' })
  }
}
