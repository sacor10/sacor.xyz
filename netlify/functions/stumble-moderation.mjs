import { requireModerator } from './_lib/moderators.mjs'
import {
  APPROVED_INDEX_KEY,
  PENDING_INDEX_KEY,
  REJECTED_INDEX_KEY,
  clientPage,
  getPagesStore,
  inferContentType,
  json,
  loadApprovedIndex,
  loadJson,
  moderationSummaryOf,
  normalizeContentType,
  normalizeFramePolicy,
  normalizeInterests,
  normalizePageRecord,
  pageKey,
  qualityScore,
  removeSummary,
  saveJson,
  summaryOf,
  upsertSummary,
} from './_lib/stumble.mjs'

async function loadIndexedPages(store, key) {
  const index = await loadJson(store, key, [])
  const pages = []
  for (const summary of Array.isArray(index) ? index : []) {
    if (!summary?.id) continue
    const raw = await store.get(pageKey(summary.id))
    if (!raw) continue
    try {
      pages.push(JSON.parse(raw))
    } catch {
      /* ignore malformed moderation records */
    }
  }
  return pages
}

function trimText(value, max) {
  return String(value || '').trim().slice(0, max)
}

async function removeFromPending(store, id) {
  const pending = await loadJson(store, PENDING_INDEX_KEY, [])
  const next = Array.isArray(pending) ? [...pending] : []
  removeSummary(next, id)
  await saveJson(store, PENDING_INDEX_KEY, next)
}

// Drop a page's summary from one of the moderation indexes (approved/rejected).
async function removeFromIndex(store, key, id) {
  const index = await loadJson(store, key, [])
  const next = Array.isArray(index) ? [...index] : []
  removeSummary(next, id)
  await saveJson(store, key, next)
}

export default async (req) => {
  const owner = await requireModerator(req)
  if (owner.error) return owner.error

  const store = getPagesStore()

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const status = url.searchParams.get('status') || 'pending'
    const key =
      status === 'approved'
        ? APPROVED_INDEX_KEY
        : status === 'rejected'
          ? REJECTED_INDEX_KEY
          : PENDING_INDEX_KEY
    const pages = await loadIndexedPages(store, key)
    return json({ pages, status })
  }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const id = typeof body?.id === 'string' ? body.id : ''
  const action = body?.action
  if (!id) return json({ error: 'id is required' }, { status: 400 })
  if (action !== 'approve' && action !== 'reject' && action !== 'delete') {
    return json({ error: 'action must be approve, reject, or delete' }, { status: 400 })
  }

  // Permanently remove a page (used to undo an accidental approval). Deletes the
  // record and clears it from every moderation index so it can't resurface; the
  // public feed drops it automatically because loadPageCard ignores missing records.
  if (action === 'delete') {
    await store.delete(pageKey(id))
    await removeFromIndex(store, APPROVED_INDEX_KEY, id)
    await removeFromIndex(store, REJECTED_INDEX_KEY, id)
    await removeFromPending(store, id)
    return json({ ok: true })
  }

  const raw = await store.get(pageKey(id))
  if (!raw) return json({ error: 'Submission not found' }, { status: 404 })

  let existing
  try {
    existing = JSON.parse(raw)
  } catch {
    return json({ error: 'Stored submission is malformed' }, { status: 500 })
  }

  if (action === 'reject') {
    const rejected = normalizePageRecord({
      ...existing,
      status: 'rejected',
      rejectionReason: trimText(body?.reason, 300),
      rejectedAt: new Date().toISOString(),
      rejectedBy: owner.session.email,
    })
    await store.set(pageKey(id), JSON.stringify(rejected))
    await removeFromPending(store, id)
    const rejectedIndex = await loadJson(store, REJECTED_INDEX_KEY, [])
    const nextRejected = Array.isArray(rejectedIndex) ? [...rejectedIndex] : []
    upsertSummary(nextRejected, moderationSummaryOf(rejected))
    await saveJson(store, REJECTED_INDEX_KEY, nextRejected)
    return json({ ok: true, page: rejected })
  }

  const interests = normalizeInterests(body?.interests?.length ? body.interests : existing.interests)
  if (!interests.length) return json({ error: 'Approved pages need at least one interest' }, { status: 400 })

  const approved = normalizePageRecord({
    ...existing,
    title: trimText(body?.title, 140) || existing.title,
    description: trimText(body?.description, 300) || existing.description,
    interests,
    contentType: normalizeContentType(
      body?.contentType,
      normalizeContentType(existing.contentType, inferContentType({ ...existing, interests })),
    ),
    framePolicy: normalizeFramePolicy(body?.framePolicy || existing.framePolicy),
    qualityScore: qualityScore(body?.qualityScore, existing.qualityScore ?? 0.65),
    status: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy: owner.session.email,
  })

  await store.set(pageKey(id), JSON.stringify(approved))
  await removeFromPending(store, id)
  const approvedIndex = await loadApprovedIndex(store)
  const nextApproved = Array.isArray(approvedIndex) ? [...approvedIndex] : []
  upsertSummary(nextApproved, summaryOf(approved))
  await saveJson(store, APPROVED_INDEX_KEY, nextApproved)

  return json({ ok: true, page: clientPage(approved) })
}
