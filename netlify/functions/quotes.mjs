import { getTursoClient } from './_lib/turso.mjs'
import { readSessionCookie } from './_lib/session.mjs'
import { quotes as seedQuotes } from '../../src/data/quotes.js'

const SEED_VERSION = 'v1'
const MAX_QUOTES = 500
const TEXT_MAX = 4000
const SPEAKER_MAX = 120
const DATE_MAX = 60
const SOURCE_MAX = 120
const CONTEXT_MAX = 2000
const LINK_MAX = 500
const TAG_MAX = 40
const TAGS_MAX_COUNT = 10

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 6)
    .join(' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'quote'
}

async function uniqueSlug(db, base, excludeId = null) {
  let candidate = base
  let n = 2
  for (;;) {
    const sql = excludeId
      ? 'SELECT id FROM quotes WHERE slug = ? AND id != ?'
      : 'SELECT id FROM quotes WHERE slug = ?'
    const args = excludeId ? [candidate, excludeId] : [candidate]
    const result = await db.execute({ sql, args })
    if (result.rows.length === 0) return candidate
    candidate = `${base}-${n}`
    n += 1
  }
}

const publicQuote = (row) => ({
  id: row.slug,
  text: row.body,
  speaker: row.speaker,
  date: row.quote_date,
  source: row.source,
  context: row.context,
  link: row.link,
  tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
  pinned: !!row.pinned,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

let readyPromise = null

async function ensureSchema(db) {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      body TEXT NOT NULL,
      speaker TEXT NOT NULL DEFAULT '',
      quote_date TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      context TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '',
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`
  )
  await db.execute(
    `CREATE TABLE IF NOT EXISTS quotes_seed (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`
  )

  const seeded = await db.execute({
    sql: 'SELECT version FROM quotes_seed WHERE version = ?',
    args: [SEED_VERSION],
  })
  if (seeded.rows.length > 0) return

  for (const quote of seedQuotes) {
    const slug = await uniqueSlug(db, quote.id || slugify(quote.text))
    await db.execute({
      sql: `INSERT INTO quotes (slug, body, speaker, quote_date, source, context, link, tags, pinned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        slug,
        quote.text || '',
        quote.speaker || '',
        quote.date || '',
        quote.source || '',
        quote.context || '',
        quote.link || '',
        Array.isArray(quote.tags) ? quote.tags.join(',') : '',
        quote.pinned ? 1 : 0,
      ],
    })
  }

  await db.execute({
    sql: 'INSERT OR IGNORE INTO quotes_seed (version) VALUES (?)',
    args: [SEED_VERSION],
  })
}

function validate(body) {
  const text = String(body?.text ?? '').trim()
  const speaker = String(body?.speaker ?? '').trim()
  const date = String(body?.date ?? '').trim()
  const source = String(body?.source ?? '').trim()
  const context = String(body?.context ?? '').trim()
  const link = String(body?.link ?? '').trim()
  const rawTags = Array.isArray(body?.tags) ? body.tags : []
  const pinned = !!body?.pinned

  if (!text || text.length > TEXT_MAX) {
    return { error: `Quote text is required (max ${TEXT_MAX} characters).` }
  }
  if (speaker.length > SPEAKER_MAX) {
    return { error: `Speaker is too long (max ${SPEAKER_MAX} characters).` }
  }
  if (date.length > DATE_MAX) {
    return { error: `Date is too long (max ${DATE_MAX} characters).` }
  }
  if (source.length > SOURCE_MAX) {
    return { error: `Source is too long (max ${SOURCE_MAX} characters).` }
  }
  if (context.length > CONTEXT_MAX) {
    return { error: `Context is too long (max ${CONTEXT_MAX} characters).` }
  }
  if (link) {
    if (link.length > LINK_MAX) {
      return { error: `Link is too long (max ${LINK_MAX} characters).` }
    }
    try {
      const parsed = new URL(link)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { error: 'Link must be an http(s) URL.' }
      }
    } catch {
      return { error: 'Link must be a valid URL.' }
    }
  }
  const tags = rawTags
    .map((tag) => String(tag ?? '').trim())
    .filter(Boolean)
    .slice(0, TAGS_MAX_COUNT)
  if (tags.some((tag) => tag.length > TAG_MAX)) {
    return { error: `Each tag must be ${TAG_MAX} characters or fewer.` }
  }

  return { value: { text, speaker, date, source, context, link, tags, pinned } }
}

export default async (req) => {
  const db = await getTursoClient()
  if (!readyPromise) readyPromise = ensureSchema(db)
  await readyPromise

  const session = readSessionCookie(req)

  if (req.method === 'GET') {
    if (!session) {
      return json({ error: 'Sign in with Google to read the quotes.' }, 401)
    }
    const result = await db.execute({
      sql: `SELECT * FROM quotes ORDER BY pinned DESC, id DESC LIMIT ?`,
      args: [MAX_QUOTES],
    })
    return json({
      quotes: result.rows.map(publicQuote),
      canEdit: !!session.isQuotesAdmin,
    })
  }

  if (!session) return json({ error: 'Unauthorized' }, 401)
  if (!session.isQuotesAdmin) return json({ error: 'Forbidden' }, 403)

  if (req.method === 'POST') {
    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400)
    }
    const { error, value } = validate(body)
    if (error) return json({ error }, 400)

    const count = await db.execute('SELECT COUNT(*) AS n FROM quotes')
    if (Number(count.rows[0]?.n ?? 0) >= MAX_QUOTES) {
      return json({ error: 'Quote limit reached.' }, 400)
    }

    const slug = await uniqueSlug(db, slugify(value.text))
    const result = await db.execute({
      sql: `INSERT INTO quotes (slug, body, speaker, quote_date, source, context, link, tags, pinned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *`,
      args: [
        slug,
        value.text,
        value.speaker,
        value.date,
        value.source,
        value.context,
        value.link,
        value.tags.join(','),
        value.pinned ? 1 : 0,
      ],
    })
    return json({ quote: publicQuote(result.rows[0]) }, 201)
  }

  if (req.method === 'PUT') {
    const idParam = new URL(req.url).searchParams.get('id')
    if (!idParam) return json({ error: 'Missing id' }, 400)

    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400)
    }
    const { error, value } = validate(body)
    if (error) return json({ error }, 400)

    const existing = await db.execute({
      sql: 'SELECT id, slug, body FROM quotes WHERE slug = ?',
      args: [idParam],
    })
    if (existing.rows.length === 0) return json({ error: 'Not found' }, 404)

    const row = existing.rows[0]
    const slug =
      value.text === row.body ? row.slug : await uniqueSlug(db, slugify(value.text), row.id)

    const result = await db.execute({
      sql: `UPDATE quotes
            SET slug = ?, body = ?, speaker = ?, quote_date = ?, source = ?, context = ?, link = ?, tags = ?, pinned = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = ?
            RETURNING *`,
      args: [
        slug,
        value.text,
        value.speaker,
        value.date,
        value.source,
        value.context,
        value.link,
        value.tags.join(','),
        value.pinned ? 1 : 0,
        row.id,
      ],
    })
    return json({ quote: publicQuote(result.rows[0]) })
  }

  if (req.method === 'DELETE') {
    const idParam = new URL(req.url).searchParams.get('id')
    if (!idParam) return json({ error: 'Missing id' }, 400)

    const existing = await db.execute({
      sql: 'SELECT id FROM quotes WHERE slug = ?',
      args: [idParam],
    })
    if (existing.rows.length === 0) return json({ error: 'Not found' }, 404)

    await db.execute({ sql: 'DELETE FROM quotes WHERE slug = ?', args: [idParam] })
    return json({ ok: true })
  }

  return json({ error: 'Method not allowed' }, 405)
}
