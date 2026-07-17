import { getStore } from '@netlify/blobs'
import { getTursoClient } from './_lib/turso.mjs'

const SEED = 0
const NAME = 'hits'

const json = (count) =>
  new Response(JSON.stringify({ count }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

// One-time migration seed: carry the legacy Netlify Blobs count into Turso
// the first time the counters row is created.
async function legacyBlobCount() {
  try {
    const store = getStore('hits')
    return Number((await store.get('count')) ?? SEED)
  } catch {
    return SEED
  }
}

let readyPromise = null

async function ensureCounter(db) {
  await db.execute(
    'CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL)'
  )
  const existing = await db.execute({
    sql: 'SELECT value FROM counters WHERE name = ?',
    args: [NAME],
  })
  if (existing.rows.length === 0) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO counters (name, value) VALUES (?, ?)',
      args: [NAME, await legacyBlobCount()],
    })
  }
}

export default async (req) => {
  const db = await getTursoClient()
  if (!readyPromise) readyPromise = ensureCounter(db)
  await readyPromise

  if (req.method === 'DELETE') {
    await db.execute({
      sql: 'UPDATE counters SET value = ? WHERE name = ?',
      args: [SEED, NAME],
    })
    return json(SEED)
  }

  if (req.method === 'POST') {
    const result = await db.execute({
      sql: 'UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value',
      args: [NAME],
    })
    return json(Number(result.rows[0]?.value ?? SEED))
  }

  const result = await db.execute({
    sql: 'SELECT value FROM counters WHERE name = ?',
    args: [NAME],
  })
  return json(Number(result.rows[0]?.value ?? SEED))
}
