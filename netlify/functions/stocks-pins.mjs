import { getStore } from '@netlify/blobs'
import { readSessionCookie, userKeyPrefix } from './_lib/session.mjs'

const DEFAULT_SYMBOLS = ['GLD', 'GDX', 'BTC-USD', 'NVDA', 'SPACEX']
const SYMBOL_RE = /^[A-Z.-]{1,8}$/
const MAX_SYMBOLS = 20

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  })

const pinsKey = (email) => `${userKeyPrefix(email)}/stocks/pins`

const normalizeSymbols = (value) => {
  if (!Array.isArray(value)) throw new Error('symbols must be an array')

  const symbols = []
  for (const item of value) {
    const symbol = String(item ?? '').trim().toUpperCase()
    if (!SYMBOL_RE.test(symbol)) {
      throw new Error(`invalid symbol: ${symbol || '(blank)'}`)
    }
    if (!symbols.includes(symbol) && symbols.length < MAX_SYMBOLS) {
      symbols.push(symbol)
    }
  }

  if (symbols.length === 0) throw new Error('at least one symbol is required')
  return symbols
}

const parseSavedPins = (raw) => {
  const parsed = JSON.parse(raw)
  const symbols = normalizeSymbols(Array.isArray(parsed) ? parsed : parsed?.symbols)
  return {
    symbols,
    updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null,
  }
}

export default async (req) => {
  const session = readSessionCookie(req)
  if (!session) return json({ error: 'Unauthorized' }, { status: 401 })

  if (req.method === 'GET') {
    const store = getStore('stock-pins')
    const key = pinsKey(session.email)
    const raw = await store.get(key)
    if (!raw) {
      return json({ symbols: DEFAULT_SYMBOLS, defaulted: true, updatedAt: null })
    }

    try {
      const saved = parseSavedPins(raw)
      return json({ ...saved, defaulted: false })
    } catch {
      return json({ error: 'Saved stock pins are corrupt' }, { status: 500 })
    }
  }

  if (req.method === 'PUT') {
    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }

    let symbols
    try {
      symbols = normalizeSymbols(body?.symbols)
    } catch (err) {
      return json({ error: err.message }, { status: 400 })
    }

    const store = getStore('stock-pins')
    const key = pinsKey(session.email)
    const updatedAt = new Date().toISOString()
    await store.set(key, JSON.stringify({ symbols, updatedAt }))
    return json({ symbols, defaulted: false, updatedAt })
  }

  return new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET, PUT' },
  })
}
