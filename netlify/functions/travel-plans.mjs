import { getStore } from '@netlify/blobs'
import { requireTravelAccess } from './_lib/session.mjs'
import { sfStops } from '../../src/data/sfTrip.js'

const INDEX_KEY = 'index'
const SEED_PLAN_ID = 'sf-long-weekend-demo'
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

const buildSeedMarkdown = (stops) => {
  const lines = [
    '# SF Long Weekend',
    '',
    'A scenic one-day loop hitting San Francisco\'s classic landmarks. Edit or delete this demo plan whenever you want — it only seeds once your itinerary list is empty.',
    '',
    '## Stops',
    '',
  ]
  stops.forEach((s, i) => {
    let line = `${i + 1}. **${s.name}**`
    if (s.arrivalTime) line += ` — ${s.arrivalTime}`
    if (s.durationMinutes) line += ` _(${s.durationMinutes} min)_`
    if (s.notes) line += `  \n   ${s.notes}`
    lines.push(line)
  })
  return lines.join('\n')
}

const seedIfEmpty = async (store, list) => {
  if (list.length > 0) return list
  const now = new Date().toISOString()
  const plan = {
    id: SEED_PLAN_ID,
    title: 'SF Long Weekend',
    destination: 'San Francisco, CA',
    body: buildSeedMarkdown(sfStops),
    stops: sfStops,
    createdAt: now,
    updatedAt: now,
  }
  await store.set(planKey(plan.id), JSON.stringify(plan))
  const summary = { id: plan.id, title: plan.title, destination: plan.destination, updatedAt: now }
  const next = [summary]
  await saveIndex(store, next)
  return next
}

const sanitizeStops = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (!Array.isArray(value)) throw new Error('stops must be an array')
  if (value.length > 100) throw new Error('stops too long (max 100)')
  return value.map((s, i) => {
    if (!s || typeof s !== 'object') throw new Error(`stops[${i}] must be an object`)
    const lat = Number(s.lat)
    const lng = Number(s.lng)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error(`stops[${i}].lat invalid`)
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error(`stops[${i}].lng invalid`)
    const name = sanitizeString(s.name, 200).trim()
    if (!name) throw new Error(`stops[${i}].name required`)
    const out = { name, lat, lng }
    if (typeof s.arrivalTime === 'string') out.arrivalTime = sanitizeString(s.arrivalTime, 50)
    if (Number.isFinite(Number(s.durationMinutes))) out.durationMinutes = Number(s.durationMinutes)
    if (typeof s.notes === 'string') out.notes = sanitizeString(s.notes, 1000)
    return out
  })
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
    const stored = await loadIndex(store)
    const list = await seedIfEmpty(store, stored)
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
    let stops
    try {
      stops = sanitizeStops(body?.stops)
    } catch (err) {
      return json({ error: err.message }, { status: 400 })
    }

    const newId = crypto.randomUUID()
    const now = new Date().toISOString()
    const plan = { id: newId, title, destination, body: markdown, createdAt: now, updatedAt: now }
    if (stops) plan.stops = stops
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
    let stops
    try {
      stops = body && 'stops' in body ? sanitizeStops(body.stops) : (existing.stops ?? null)
    } catch (err) {
      return json({ error: err.message }, { status: 400 })
    }
    const now = new Date().toISOString()
    const updated = { ...existing, title, destination, body: markdown, updatedAt: now }
    if (stops) updated.stops = stops
    else delete updated.stops
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
