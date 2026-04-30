import { getStore } from '@netlify/blobs'
import { requireTravelAccess } from './_lib/session.mjs'

const INDEX_KEY = 'index'
const planKey = (id) => `plans/${id}`

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  })

const loadIndex = async (store) => {
  const raw = await store.get(INDEX_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveIndex = (store, list) => store.set(INDEX_KEY, JSON.stringify(list))

const sanitizeString = (value, max) => {
  if (typeof value !== 'string') return ''
  return value.slice(0, max)
}

export default async (req) => {
  const auth = requireTravelAccess(req)
  if (auth.error) return auth.error

  const store = getStore('travel-plans')
  const url = new URL(req.url)
  const id = url.searchParams.get('id')

  if (req.method === 'GET') {
    if (id) {
      const raw = await store.get(planKey(id))
      if (!raw) return json({ error: 'Not found' }, { status: 404 })
      return json(JSON.parse(raw))
    }
    const list = await loadIndex(store)
    return json({ plans: list })
  }

  if (req.method === 'POST') {
    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const title = sanitizeString(body?.title, 200).trim()
    const destination = sanitizeString(body?.destination, 200).trim()
    const markdown = sanitizeString(body?.body, 100_000)
    if (!title) return json({ error: 'Title is required' }, { status: 400 })

    const newId = crypto.randomUUID()
    const now = new Date().toISOString()
    const plan = { id: newId, title, destination, body: markdown, createdAt: now, updatedAt: now }
    await store.set(planKey(newId), JSON.stringify(plan))
    const list = await loadIndex(store)
    list.unshift({ id: newId, title, destination, updatedAt: now })
    await saveIndex(store, list)
    return json(plan, { status: 201 })
  }

  if (req.method === 'PUT') {
    if (!id) return json({ error: 'Missing id' }, { status: 400 })
    const raw = await store.get(planKey(id))
    if (!raw) return json({ error: 'Not found' }, { status: 404 })
    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const existing = JSON.parse(raw)
    const title = sanitizeString(body?.title ?? existing.title, 200).trim() || existing.title
    const destination = sanitizeString(body?.destination ?? existing.destination, 200).trim()
    const markdown = sanitizeString(body?.body ?? existing.body, 100_000)
    const now = new Date().toISOString()
    const updated = { ...existing, title, destination, body: markdown, updatedAt: now }
    await store.set(planKey(id), JSON.stringify(updated))

    const list = await loadIndex(store)
    const idx = list.findIndex((p) => p.id === id)
    const summary = { id, title, destination, updatedAt: now }
    if (idx >= 0) list[idx] = summary
    else list.unshift(summary)
    await saveIndex(store, list)

    return json(updated)
  }

  if (req.method === 'DELETE') {
    if (!id) return json({ error: 'Missing id' }, { status: 400 })
    await store.delete(planKey(id))
    const list = await loadIndex(store)
    const next = list.filter((p) => p.id !== id)
    await saveIndex(store, next)
    return json({ ok: true })
  }

  return new Response('Method Not Allowed', { status: 405 })
}
