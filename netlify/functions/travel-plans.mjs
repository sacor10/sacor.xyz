import { getStore } from '@netlify/blobs'
import {
  canCreateTravelPlans,
  normalizeEmail,
  requireTravelAccess,
  userHash,
  userKeyPrefix,
  userKeyPrefixFromHash,
} from './_lib/session.mjs'
import { sfStops } from '../../src/data/sfTrip.js'

const SEED_PLAN_ID = 'sf-long-weekend-demo'
const indexKey = (prefix) => `${prefix}/index`
const planKey = (prefix, id) => `${prefix}/plans/${id}`
const sharedIndexKey = (recipientHash) => `shared/${recipientHash}/index`

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  })

const loadJsonArray = async (store, key) => {
  const raw = await store.get(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveJsonArray = (store, key, list) => store.set(key, JSON.stringify(list))

const loadIndex = (store, prefix) => loadJsonArray(store, indexKey(prefix))
const saveIndex = (store, prefix, list) => saveJsonArray(store, indexKey(prefix), list)
const loadSharedIndex = (store, recipientHash) => loadJsonArray(store, sharedIndexKey(recipientHash))
const saveSharedIndex = (store, recipientHash, list) =>
  saveJsonArray(store, sharedIndexKey(recipientHash), list)

const sanitizeString = (value, max) => {
  if (typeof value !== 'string') return ''
  return value.slice(0, max)
}

const uniqueEmails = (emails) => {
  const seen = new Set()
  const out = []
  for (const email of Array.isArray(emails) ? emails : []) {
    const normalized = normalizeEmail(email)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

const buildSeedMarkdown = (stops) => {
  const lines = [
    '# SF Long Weekend',
    '',
    'A scenic one-day loop hitting San Francisco\'s classic landmarks. Edit or delete this demo plan whenever you want - it only seeds once your itinerary list is empty.',
    '',
    '## Stops',
    '',
  ]
  stops.forEach((s, i) => {
    let line = `${i + 1}. **${s.name}**`
    if (s.arrivalTime) line += ` - ${s.arrivalTime}`
    if (s.durationMinutes) line += ` _(${s.durationMinutes} min)_`
    if (s.notes) line += `  \n   ${s.notes}`
    lines.push(line)
  })
  return lines.join('\n')
}

const normalizePlan = (plan, ownerEmail, ownerHash) => {
  const fallbackOwnerEmail = normalizeEmail(ownerEmail || plan?.ownerEmail)
  const fallbackOwnerHash = ownerHash || plan?.ownerHash || (fallbackOwnerEmail ? userHash(fallbackOwnerEmail) : '')
  const collaborators = uniqueEmails(plan?.collaborators).filter((email) => email !== fallbackOwnerEmail)
  const version = Number.isInteger(plan?.version) && plan.version > 0 ? plan.version : 1
  return {
    ...plan,
    ownerEmail: fallbackOwnerEmail,
    ownerHash: fallbackOwnerHash,
    collaborators,
    version,
    updatedBy: normalizeEmail(plan?.updatedBy) || fallbackOwnerEmail,
  }
}

const summaryForPlan = (plan, access) => ({
  id: plan.id,
  title: plan.title,
  destination: plan.destination || '',
  updatedAt: plan.updatedAt,
  updatedBy: plan.updatedBy || plan.ownerEmail,
  ownerEmail: plan.ownerEmail,
  ownerHash: plan.ownerHash,
  version: plan.version || 1,
  access,
})

const legacyOwnedSummary = (summary, ownerEmail, ownerHash) => ({
  id: summary.id,
  title: summary.title,
  destination: summary.destination || '',
  updatedAt: summary.updatedAt,
  updatedBy: summary.updatedBy || ownerEmail,
  ownerEmail,
  ownerHash,
  version: Number.isInteger(summary.version) && summary.version > 0 ? summary.version : 1,
  access: 'owner',
})

const clientPlan = (plan, access) => {
  const { collaborators, ...safePlan } = plan
  return {
    ...safePlan,
    access,
    isOwner: access === 'owner',
    isShared: access === 'shared',
    collaboratorCount: collaborators.length,
  }
}

const updateOwnedIndex = async (store, plan) => {
  const prefix = userKeyPrefixFromHash(plan.ownerHash)
  if (!prefix) return
  const list = await loadIndex(store, prefix)
  const summary = summaryForPlan(plan, 'owner')
  const idx = list.findIndex((p) => p.id === plan.id)
  if (idx >= 0) list[idx] = summary
  else list.unshift(summary)
  await saveIndex(store, prefix, list)
}

const updateSharedIndexForEmail = async (store, email, plan) => {
  const recipientHash = userHash(email)
  const list = await loadSharedIndex(store, recipientHash)
  const summary = summaryForPlan(plan, 'shared')
  const idx = list.findIndex((p) => p.id === plan.id && p.ownerHash === plan.ownerHash)
  if (idx >= 0) list[idx] = summary
  else list.unshift(summary)
  await saveSharedIndex(store, recipientHash, list)
}

const removeSharedIndexForEmail = async (store, email, plan) => {
  const recipientHash = userHash(email)
  const list = await loadSharedIndex(store, recipientHash)
  const next = list.filter((p) => !(p.id === plan.id && p.ownerHash === plan.ownerHash))
  if (next.length !== list.length) await saveSharedIndex(store, recipientHash, next)
}

const refreshPlanIndexes = async (store, plan) => {
  await updateOwnedIndex(store, plan)
  await Promise.all(plan.collaborators.map((email) => updateSharedIndexForEmail(store, email, plan)))
}

const removePlanFromIndexes = async (store, plan) => {
  const prefix = userKeyPrefixFromHash(plan.ownerHash)
  if (prefix) {
    const list = await loadIndex(store, prefix)
    await saveIndex(store, prefix, list.filter((p) => p.id !== plan.id))
  }
  await Promise.all(plan.collaborators.map((email) => removeSharedIndexForEmail(store, email, plan)))
}

const seedIfEmpty = async (store, prefix, list, ownerEmail, ownerHash) => {
  if (list.length > 0) return list.map((summary) => legacyOwnedSummary(summary, ownerEmail, ownerHash))
  const now = new Date().toISOString()
  const plan = {
    id: SEED_PLAN_ID,
    title: 'SF Long Weekend',
    destination: 'San Francisco, CA',
    body: buildSeedMarkdown(sfStops),
    stops: sfStops,
    createdAt: now,
    updatedAt: now,
    updatedBy: ownerEmail,
    ownerEmail,
    ownerHash,
    collaborators: [],
    version: 1,
  }
  await store.set(planKey(prefix, plan.id), JSON.stringify(plan))
  const next = [summaryForPlan(plan, 'owner')]
  await saveIndex(store, prefix, next)
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

const loadPlanByOwnerHash = async (store, ownerHash, id, ownerEmail = '') => {
  const prefix = userKeyPrefixFromHash(ownerHash)
  if (!prefix) return { error: json({ error: 'Invalid owner' }, { status: 400 }) }
  const raw = await store.get(planKey(prefix, id))
  if (!raw) return { missing: true }
  try {
    return { plan: normalizePlan(JSON.parse(raw), ownerEmail, ownerHash), prefix }
  } catch {
    return { error: json({ error: 'Plan data is corrupt' }, { status: 500 }) }
  }
}

const resolvePlanAccess = async (store, sessionEmail, id, ownerHashParam) => {
  const sessionHash = userHash(sessionEmail)
  const sessionCanCreate = canCreateTravelPlans(sessionEmail)

  if (ownerHashParam) {
    const requestedOwnerHash = String(ownerHashParam).trim().toLowerCase()
    const loaded = await loadPlanByOwnerHash(
      store,
      requestedOwnerHash,
      id,
      requestedOwnerHash === sessionHash ? sessionEmail : '',
    )
    if (loaded.error || loaded.missing) return loaded
    const isOwner = loaded.plan.ownerHash === sessionHash && sessionCanCreate
    const isCollaborator = loaded.plan.collaborators.includes(sessionEmail)
    if (!isOwner && !isCollaborator) return { missing: true }
    return { ...loaded, access: isOwner ? 'owner' : 'shared' }
  }

  if (sessionCanCreate) {
    const own = await loadPlanByOwnerHash(store, sessionHash, id, sessionEmail)
    if (own.error) return own
    if (own.plan) return { ...own, access: 'owner' }
  }

  const shared = await loadSharedIndex(store, sessionHash)
  for (const ref of shared.filter((p) => p.id === id && p.ownerHash)) {
    const loaded = await loadPlanByOwnerHash(store, ref.ownerHash, id, ref.ownerEmail)
    if (loaded.error || loaded.missing) continue
    if (loaded.plan.collaborators.includes(sessionEmail)) {
      return { ...loaded, access: 'shared' }
    }
  }
  return { missing: true }
}

const loadSharedPlans = async (store, sessionEmail) => {
  const recipientHash = userHash(sessionEmail)
  const refs = await loadSharedIndex(store, recipientHash)
  const summaries = []
  const nextRefs = []

  for (const ref of refs) {
    if (!ref?.id || !ref?.ownerHash) continue
    const loaded = await loadPlanByOwnerHash(store, ref.ownerHash, ref.id, ref.ownerEmail)
    if (loaded.error || loaded.missing) continue
    if (!loaded.plan.collaborators.includes(sessionEmail)) continue
    const summary = summaryForPlan(loaded.plan, 'shared')
    summaries.push(summary)
    nextRefs.push(summary)
  }

  if (nextRefs.length !== refs.length || JSON.stringify(nextRefs) !== JSON.stringify(refs)) {
    await saveSharedIndex(store, recipientHash, nextRefs)
  }

  return summaries
}

export default async (req) => {
  const auth = requireTravelAccess(req)
  if (auth.error) return auth.error

  const sessionEmail = normalizeEmail(auth.session.email)
  const sessionHash = userHash(sessionEmail)
  const sessionCanCreate = canCreateTravelPlans(sessionEmail)
  const prefix = userKeyPrefix(sessionEmail)
  const store = getStore('travel-plans')
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const ownerHashParam = url.searchParams.get('owner')

  if (req.method === 'GET') {
    if (id) {
      const resolved = await resolvePlanAccess(store, sessionEmail, id, ownerHashParam)
      if (resolved.error) return resolved.error
      if (resolved.missing) return json({ error: 'Not found' }, { status: 404 })
      return json(clientPlan(resolved.plan, resolved.access))
    }

    const ownedPlans = sessionCanCreate
      ? await seedIfEmpty(store, prefix, await loadIndex(store, prefix), sessionEmail, sessionHash)
      : []
    const sharedPlans = await loadSharedPlans(store, sessionEmail)
    return json({ ownedPlans, sharedPlans, plans: ownedPlans })
  }

  if (req.method === 'POST') {
    if (!sessionCanCreate) return json({ error: 'Forbidden' }, { status: 403 })
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
    const plan = {
      id: newId,
      title,
      destination,
      body: markdown,
      createdAt: now,
      updatedAt: now,
      updatedBy: sessionEmail,
      ownerEmail: sessionEmail,
      ownerHash: sessionHash,
      collaborators: [],
      version: 1,
    }
    if (stops) plan.stops = stops
    await store.set(planKey(prefix, newId), JSON.stringify(plan))
    await updateOwnedIndex(store, plan)
    return json(clientPlan(plan, 'owner'), { status: 201 })
  }

  if (req.method === 'PUT') {
    if (!id) return json({ error: 'Missing id' }, { status: 400 })
    const resolved = await resolvePlanAccess(store, sessionEmail, id, ownerHashParam)
    if (resolved.error) return resolved.error
    if (resolved.missing) return json({ error: 'Not found' }, { status: 404 })

    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const existing = resolved.plan
    if (Number(body?.version) !== existing.version) {
      return json(
        {
          error: 'This plan changed while you were editing. Reload the latest version before saving.',
          currentVersion: existing.version,
        },
        { status: 409 },
      )
    }

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
    const updated = {
      ...existing,
      title,
      destination,
      body: markdown,
      updatedAt: now,
      updatedBy: sessionEmail,
      version: existing.version + 1,
    }
    if (stops) updated.stops = stops
    else delete updated.stops
    await store.set(planKey(resolved.prefix, id), JSON.stringify(updated))
    await refreshPlanIndexes(store, updated)

    return json(clientPlan(updated, resolved.access))
  }

  if (req.method === 'DELETE') {
    if (!id) return json({ error: 'Missing id' }, { status: 400 })
    const resolved = await resolvePlanAccess(store, sessionEmail, id, ownerHashParam)
    if (resolved.error) return resolved.error
    if (resolved.missing) return json({ error: 'Not found' }, { status: 404 })
    if (resolved.access !== 'owner') return json({ error: 'Only the owner can delete this plan' }, { status: 403 })
    await store.delete(planKey(resolved.prefix, id))
    await removePlanFromIndexes(store, resolved.plan)
    return json({ ok: true })
  }

  return new Response('Method Not Allowed', { status: 405 })
}
