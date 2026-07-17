const LOCAL_FALLBACK_URL = 'file:./.data/sacor.db'

let clientPromise = null

async function createTursoClient() {
  const url = process.env.TURSO_DATABASE_URL || LOCAL_FALLBACK_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  const config = authToken ? { url, authToken } : { url }

  if (/^(?:libsql|https?):/i.test(url)) {
    const { createClient } = await import('@libsql/client/http')
    return createClient(config)
  }

  if (url === LOCAL_FALLBACK_URL) {
    const { mkdirSync } = await import('node:fs')
    mkdirSync('./.data', { recursive: true })
  }
  const { createClient } = await import('@libsql/client')
  return createClient(config)
}

export function getTursoClient() {
  if (!clientPromise) clientPromise = createTursoClient()
  return clientPromise
}
