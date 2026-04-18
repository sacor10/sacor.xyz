import { getStore } from '@netlify/blobs'

const SEED = 0
const KEY = 'count'

const json = (count) =>
  new Response(JSON.stringify({ count }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

export default async (req) => {
  const store = getStore('hits')

  if (req.method === 'DELETE') {
    await store.delete(KEY)
    return json(SEED)
  }

  const current = Number((await store.get(KEY)) ?? SEED)

  if (req.method === 'POST') {
    const next = current + 1
    await store.set(KEY, String(next))
    return json(next)
  }

  return json(current)
}
