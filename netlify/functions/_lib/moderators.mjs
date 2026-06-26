import { isOwnerEmail, normalizeEmail, readSessionCookie } from './session.mjs'
import { getUsersStore, loadJson, saveJson } from './stumble.mjs'

// The moderator roster lives in the stumble-users store as a single JSON array
// of { email, addedBy, addedAt }. It augments the env-var owners
// (TRAVEL_PLAN_EMAILS / OWNER_EMAIL): owners are super-admins who manage the
// list, while listed moderators can review the queue. Status is recomputed from
// this list on every request, so revoking a moderator takes effect without them
// re-signing in.
export const MODERATORS_KEY = 'moderators'

// A deliberately forgiving address shape — we rely on Google having already
// verified the address; this only guards against obvious junk.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isValidModeratorEmail = (email) => EMAIL_RE.test(normalizeEmail(email))

export async function loadModerators(store) {
  const list = await loadJson(store, MODERATORS_KEY, [])
  if (!Array.isArray(list)) return []
  return list
    .map((entry) => {
      const email = normalizeEmail(entry?.email)
      if (!email) return null
      return {
        email,
        addedBy: normalizeEmail(entry?.addedBy) || null,
        addedAt: typeof entry?.addedAt === 'string' ? entry.addedAt : null,
      }
    })
    .filter(Boolean)
}

export async function loadModeratorEmails(store) {
  return (await loadModerators(store)).map((entry) => entry.email)
}

// True for env-var owners and anyone on the blob roster. Owners are always
// considered moderators so they retain queue access without being listed.
export async function isModeratorEmail(store, email) {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  if (isOwnerEmail(normalized)) return true
  return (await loadModeratorEmails(store)).includes(normalized)
}

export async function addModerator(store, email, addedBy) {
  const normalized = normalizeEmail(email)
  if (!isValidModeratorEmail(normalized)) {
    return { error: 'A valid Google account email is required' }
  }
  const list = await loadModerators(store)
  if (list.some((entry) => entry.email === normalized)) {
    return { moderators: list } // already present — idempotent
  }
  // Env-var owners are implicitly moderators; no need to store them.
  if (isOwnerEmail(normalized)) {
    return { moderators: list }
  }
  const next = [
    ...list,
    { email: normalized, addedBy: normalizeEmail(addedBy) || null, addedAt: new Date().toISOString() },
  ]
  await saveJson(store, MODERATORS_KEY, next)
  return { moderators: next }
}

export async function removeModerator(store, email) {
  const normalized = normalizeEmail(email)
  const list = await loadModerators(store)
  const next = list.filter((entry) => entry.email !== normalized)
  if (next.length !== list.length) {
    await saveJson(store, MODERATORS_KEY, next)
  }
  // Env-var owners can't be removed via the UI (they're not on the list).
  return { moderators: next }
}

// Async sibling of requireOwner: allows env-var owners and listed moderators.
export async function requireModerator(req) {
  const session = readSessionCookie(req)
  if (!session) return { error: new Response('Unauthorized', { status: 401 }) }
  const allowed = await isModeratorEmail(getUsersStore(), session.email)
  if (!allowed) return { error: new Response('Forbidden', { status: 403 }) }
  return { session }
}
