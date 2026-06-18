import { getStore } from '@netlify/blobs'
import { readSessionCookie, userKeyPrefix } from './_lib/session.mjs'

const DEFAULT_SYMBOLS = ['GC=F', 'GDX', 'BTC-USD', 'NVDA', 'SPCX']
const SYMBOL_RE = /^[A-Z0-9.=^-]{1,12}$/
const MAX_SYMBOLS = 20

// Legacy ticker symbols that get rewritten to their current equivalent the
// first time an existing pin set is read. Bump PINS_SCHEMA whenever this map
// changes so each stored record is migrated exactly once and a later, deliberate
// re-pin of an old symbol is left untouched.
const LEGACY_SYMBOL_ALIASES = { GLD: 'GC=F' }
const PINS_SCHEMA = 1

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

const migrateSymbols = (symbols) =>
  normalizeSymbols(symbols.map((symbol) => LEGACY_SYMBOL_ALIASES[symbol] ?? symbol))

const sameSymbols = (a, b) =>
  a.length === b.length && a.every((symbol, i) => symbol === b[i])

const parseSavedPins = (raw) => {
  const parsed = JSON.parse(raw)
  const symbols = normalizeSymbols(Array.isArray(parsed) ? parsed : parsed?.symbols)
  return {
    symbols,
    updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null,
    schema: Number.isInteger(parsed?.schema) ? parsed.schema : 0,
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
      if (saved.schema < PINS_SCHEMA) {
        const symbols = migrateSymbols(saved.symbols)
        const changed = !sameSymbols(symbols, saved.symbols)
        const updatedAt = changed ? new Date().toISOString() : saved.updatedAt
        await store.set(key, JSON.stringify({ symbols, updatedAt, schema: PINS_SCHEMA }))
        return json({ symbols, defaulted: false, updatedAt })
      }
      return json({ symbols: saved.symbols, defaulted: false, updatedAt: saved.updatedAt })
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
    await store.set(key, JSON.stringify({ symbols, updatedAt, schema: PINS_SCHEMA }))
    return json({ symbols, defaulted: false, updatedAt })
  }

  return new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET, PUT' },
  })
}
