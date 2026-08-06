// Shared, memoized Pay Index DB accessor — the single place both the read
// functions (netlify/functions/pay-index-*.mts) and the ingest CLI
// (scripts/pay-index-ingest.ts) get a ready-to-query Turso client from, so
// schema/seed logic runs exactly once per process and exists in exactly one
// file (schema.ts).

import type { Client } from '@libsql/client'
import { getTursoClient } from '../turso.mjs'
import { ensureSchema } from './schema.ts'

let readyPromise: Promise<void> | null = null

export async function getPayIndexDb(): Promise<Client> {
  const db = await getTursoClient()
  if (!readyPromise) readyPromise = ensureSchema(db)
  await readyPromise
  return db
}
