import { getTursoClient } from './_lib/turso.mjs'
import { readSessionCookie, normalizeEmail, userHash } from './_lib/session.mjs'

const COOLDOWN_MS = 60 * 60 * 1000
const MAX_ENTRIES = 200
const NAME_MAX = 40
const LOCATION_MAX = 60
const MESSAGE_MAX = 500

const PALETTE = ['#FF00FF', '#00FFFF', '#FFFF00', '#00FF00', '#FF6699', '#FF9933']

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

// Private columns (email, user_hash) are stored for identity/moderation —
// e.g. blocking specific addresses later — and must never leave the server.
const publicEntry = (row) => ({
  id: Number(row.id),
  name: row.name,
  location: row.location,
  message: row.message,
  color: row.color,
  created_at: row.created_at,
})

let readyPromise = null

async function ensureTable(db) {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS guestbook_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_hash TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`
  )
}

function colorFor(hash) {
  const nibble = parseInt(hash.slice(0, 2), 16)
  return PALETTE[nibble % PALETTE.length]
}

export default async (req) => {
  const db = await getTursoClient()
  if (!readyPromise) readyPromise = ensureTable(db)
  await readyPromise

  if (req.method === 'GET') {
    const result = await db.execute({
      sql: `SELECT id, name, location, message, color, created_at
            FROM guestbook_entries ORDER BY id DESC LIMIT ?`,
      args: [MAX_ENTRIES],
    })
    const total = await db.execute('SELECT COUNT(*) AS n FROM guestbook_entries')
    return json({
      entries: result.rows.map(publicEntry),
      count: Number(total.rows[0]?.n ?? 0),
    })
  }

  if (req.method === 'POST') {
    const session = readSessionCookie(req)
    if (!session) return json({ error: 'You must sign in with Google to sign the guestbook.' }, 401)

    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400)
    }

    const name = String(body?.name ?? '').trim()
    const location = String(body?.location ?? '').trim()
    const message = String(body?.message ?? '').trim()

    if (!name || name.length > NAME_MAX) {
      return json({ error: `Name is required (max ${NAME_MAX} characters).` }, 400)
    }
    if (location.length > LOCATION_MAX) {
      return json({ error: `Location is too long (max ${LOCATION_MAX} characters).` }, 400)
    }
    if (!message || message.length > MESSAGE_MAX) {
      return json({ error: `Message is required (max ${MESSAGE_MAX} characters).` }, 400)
    }

    const hash = userHash(session.email)

    const last = await db.execute({
      sql: `SELECT created_at FROM guestbook_entries
            WHERE user_hash = ? ORDER BY id DESC LIMIT 1`,
      args: [hash],
    })
    const lastAt = last.rows[0]?.created_at
    if (lastAt) {
      const elapsed = Date.now() - Date.parse(lastAt)
      if (Number.isFinite(elapsed) && elapsed < COOLDOWN_MS) {
        const waitMin = Math.ceil((COOLDOWN_MS - elapsed) / 60000)
        return json(
          { error: `Easy there!!! One entry per hour — try again in ~${waitMin} min.` },
          429
        )
      }
    }

    const result = await db.execute({
      sql: `INSERT INTO guestbook_entries (user_hash, email, name, location, message, color)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id, name, location, message, color, created_at`,
      args: [hash, normalizeEmail(session.email), name, location, message, colorFor(hash)],
    })
    return json({ entry: publicEntry(result.rows[0]) }, 201)
  }

  if (req.method === 'DELETE') {
    const session = readSessionCookie(req)
    if (!session) return json({ error: 'Unauthorized' }, 401)

    const id = Number(new URL(req.url).searchParams.get('id'))
    if (!Number.isInteger(id) || id <= 0) return json({ error: 'Invalid id' }, 400)

    const existing = await db.execute({
      sql: 'SELECT user_hash FROM guestbook_entries WHERE id = ?',
      args: [id],
    })
    if (existing.rows.length === 0) return json({ error: 'Not found' }, 404)

    const isAuthor = existing.rows[0].user_hash === userHash(session.email)
    if (!session.isOwner && !isAuthor) return json({ error: 'Forbidden' }, 403)

    await db.execute({ sql: 'DELETE FROM guestbook_entries WHERE id = ?', args: [id] })
    return json({ ok: true })
  }

  return json({ error: 'Method not allowed' }, 405)
}
