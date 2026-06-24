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
  userFollowingKey,
  userLikesKey,
  usernameKey,
  likeIds,
  normalizeUsername,
  pickFromPool,
  clientPage,
  appendSeen,
  json,
} from './_lib/stumble.mjs'
import { isKnownInterest } from '../../src/data/stumbleInterests.js'

// Cap the social fan-out so the blend stays a handful of Blob reads per stumble.
const MAX_SOCIAL_FOLLOWEES = 50

// GET /stumble — return one unseen, interest-matched page (PRD §6.2).
// Guests can stumble (broad pool, client supplies recently-seen ids); signed-in
// users get personalization + server-side seen/ratings exclusion. Signed-in
// users can also pass ?from=<username> to stumble a person's likes, and their
// normal feed is nudged toward pages liked by people they follow.
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

  // "Stumble their likes" — restrict the pool to one person's liked pages.
  // Requires a signed-in viewer (likes are visible to signed-in users only).
  let fromMode = false
  let fromPool = null
  const fromName = session ? normalizeUsername(url.searchParams.get('from') || '') : ''
  if (fromName) {
    const ref = await loadJson(usersStore, usernameKey(fromName), null)
    if (ref?.hash) {
      fromMode = true
      const likedSet = new Set(likeIds(await loadJson(usersStore, userLikesKey(ref.hash), [])))
      fromPool = index.filter((s) => likedSet.has(s.id) && !excluded.has(s.id))
    }
  }

  // Social blend — collect pageIds liked by people the user follows so the
  // recommender can nudge them up (skipped in from-mode, which is already
  // someone's likes).
  let socialIds = null
  if (session && !fromMode) {
    const following = await loadJson(usersStore, userFollowingKey(hash), [])
    const followees = (Array.isArray(following) ? following : []).slice(0, MAX_SOCIAL_FOLLOWEES)
    if (followees.length) {
      const lists = await Promise.all(
        followees.map((u) => loadJson(usersStore, userLikesKey(u.hash), [])),
      )
      const set = new Set()
      for (const list of lists) {
        for (const id of likeIds(list)) {
          if (!excluded.has(id)) set.add(id)
        }
      }
      if (set.size) socialIds = set
    }
  }

  const notSeen = index.filter((s) => !excluded.has(s.id))
  let pool = notSeen
  if (fromMode) {
    pool = fromPool || []
  } else if (interests && interests.size) {
    const matched = notSeen.filter((s) => (s.interests || []).some((i) => interests.has(i)))
    // Relax to the full unseen pool if interest filtering would starve the user.
    if (matched.length) pool = matched
  }

  if (!pool.length) {
    return json({ page: null, exhausted: true, remaining: 0, mode: fromMode ? 'fromUser' : null })
  }

  const summariesById = new Map(index.map((summary) => [summary.id, summary]))
  const recentSummaries = recentSeenIds
    .slice(-24)
    .map((id) => summariesById.get(id))
    .filter(Boolean)
  const picked = pickFromPool(pool, Date.now(), { recentSummaries, socialIds })
  const raw = await pagesStore.get(pageKey(picked.id))
  if (!raw) {
    // index/page drift — report gracefully instead of 500.
    return json({ page: null, exhausted: notSeen.length === 0, remaining: pool.length - 1 })
  }
  const page = JSON.parse(raw)

  if (session) {
    await saveJson(usersStore, userSeenKey(hash), appendSeen(seen, page.id))
  }

  return json({
    page: clientPage(page),
    remaining: pool.length - 1,
    exhausted: false,
    mode: fromMode ? 'fromUser' : null,
  })
}
