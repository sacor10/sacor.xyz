import { getStore } from '@netlify/blobs'

const SEED = 4269
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
  const current = Number((await store.get(KEY)) ?? SEED)

  if (req.method === 'POST') {
    const next = current + 1
    await store.set(KEY, String(next))
    return json(next)
  }

  return json(current)
}
