import { readSessionCookie, userHash } from './_lib/session.mjs'
import {
  getPagesStore,
  getUsersStore,
  loadApprovedIndex,
  loadJson,
  saveJson,
  pageKey,
  userInterestsKey,
  userSeenKey,
  userRatingsKey,
  pickFromPool,
  clientPage,
  appendSeen,
  json,
} from './_lib/stumble.mjs'
import { isKnownInterest } from '../../src/data/stumbleInterests.js'

// GET /stumble — return one unseen, interest-matched page (PRD §6.2).
// Guests can stumble (broad pool, client supplies recently-seen ids); signed-in
// users get personalization + server-side seen/ratings exclusion.
export default async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })

  const session = readSessionCookie(req)
  const url = new URL(req.url)
  const pagesStore = getPagesStore()
  const usersStore = session ? getUsersStore() : null
  const hash = session ? userHash(session.email) : null

  const index = await loadApprovedIndex(pagesStore)

  const excluded = new Set()
  let interests = null
  let seen = []
  let recentSeenIds = []

  if (session) {
    const [storedSeen, ratings, userInterests] = await Promise.all([
      loadJson(usersStore, userSeenKey(hash), []),
      loadJson(usersStore, userRatingsKey(hash), {}),
      loadJson(usersStore, userInterestsKey(hash), []),
    ])
    seen = Array.isArray(storedSeen) ? storedSeen : []
    recentSeenIds = seen
    for (const id of seen) excluded.add(id)
    if (ratings && typeof ratings === 'object') {
      for (const id of Object.keys(ratings)) excluded.add(id)
    }
    if (Array.isArray(userInterests) && userInterests.length) {
      interests = new Set(userInterests.filter(isKnownInterest))
    }
  } else {
    const ex = url.searchParams.get('exclude')
    if (ex) {
      recentSeenIds = ex.split(',').map((s) => s.trim()).filter(Boolean)
      recentSeenIds.forEach((id) => excluded.add(id))
    }
    const ints = url.searchParams.get('interests')
    if (ints) {
      const list = ints.split(',').map((s) => s.trim()).filter(isKnownInterest)
      if (list.length) interests = new Set(list)
    }
  }

  const notSeen = index.filter((s) => !excluded.has(s.id))
  let pool = notSeen
  if (interests && interests.size) {
    const matched = notSeen.filter((s) => (s.interests || []).some((i) => interests.has(i)))
    // Relax to the full unseen pool if interest filtering would starve the user.
    if (matched.length) pool = matched
  }

  if (!pool.length) {
    return json({ page: null, exhausted: true, remaining: 0 })
  }

  const summariesById = new Map(index.map((summary) => [summary.id, summary]))
  const recentSummaries = recentSeenIds
    .slice(-24)
    .map((id) => summariesById.get(id))
    .filter(Boolean)
  const picked = pickFromPool(pool, Date.now(), { recentSummaries })
  const raw = await pagesStore.get(pageKey(picked.id))
  if (!raw) {
    // index/page drift — report gracefully instead of 500.
    return json({ page: null, exhausted: notSeen.length === 0, remaining: pool.length - 1 })
  }
  const page = JSON.parse(raw)

  if (session) {
    await saveJson(usersStore, userSeenKey(hash), appendSeen(seen, page.id))
  }

  return json({ page: clientPage(page), remaining: pool.length - 1, exhausted: false })
}
