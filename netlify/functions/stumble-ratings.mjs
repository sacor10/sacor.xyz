import { readSessionCookie, userHash } from './_lib/session.mjs'
import {
  getPagesStore,
  getUsersStore,
  loadApprovedIndex,
  loadJson,
  saveJson,
  pageKey,
  APPROVED_INDEX_KEY,
  userRatingsKey,
  userSeenKey,
  userLikesKey,
  summaryOf,
  appendSeen,
  json,
} from './_lib/stumble.mjs'

// POST /ratings — record a 👍 (+1) or 👎 (-1) (PRD §6.3).
// Ratings need an account (PRD §9); guests get a 401 and are prompted to sign in.
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const session = readSessionCookie(req)
  if (!session) return json({ error: 'Sign in to rate pages' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const pageId = typeof body?.pageId === 'string' ? body.pageId : ''
  const value = Number(body?.value)
  if (!pageId) return json({ error: 'pageId is required' }, { status: 400 })
  if (value !== 1 && value !== -1) return json({ error: 'value must be +1 or -1' }, { status: 400 })

  const pagesStore = getPagesStore()
  const raw = await pagesStore.get(pageKey(pageId))
  if (!raw) return json({ error: 'Page not found' }, { status: 404 })
  const page = JSON.parse(raw)

  const usersStore = getUsersStore()
  const hash = userHash(session.email)
  const [ratings, seen, likes] = await Promise.all([
    loadJson(usersStore, userRatingsKey(hash), {}),
    loadJson(usersStore, userSeenKey(hash), []),
    loadJson(usersStore, userLikesKey(hash), []),
  ])
  const ratingMap = ratings && typeof ratings === 'object' ? ratings : {}
  const likeList = Array.isArray(likes) ? likes : []

  const prior = ratingMap[pageId]
  if (prior !== value) {
    // Apply the delta so a user can flip a vote without double-counting.
    if (prior === 1) page.upVotes = Math.max(0, (page.upVotes || 0) - 1)
    if (prior === -1) page.downVotes = Math.max(0, (page.downVotes || 0) - 1)
    if (value === 1) page.upVotes = (page.upVotes || 0) + 1
    if (value === -1) page.downVotes = (page.downVotes || 0) + 1
    ratingMap[pageId] = value

    await pagesStore.set(pageKey(pageId), JSON.stringify(page))

    // Keep the approved index vote counts in sync for scoring.
    const index = await loadApprovedIndex(pagesStore)
    const idx = index.findIndex((s) => s.id === pageId)
    if (idx >= 0) {
      index[idx] = summaryOf(page)
      await saveJson(pagesStore, APPROVED_INDEX_KEY, index)
    }

    // Maintain the Liked list index.
    const inLikes = likeList.includes(pageId)
    if (value === 1 && !inLikes) likeList.push(pageId)
    if (value === -1 && inLikes) likeList.splice(likeList.indexOf(pageId), 1)

    await Promise.all([
      saveJson(usersStore, userRatingsKey(hash), ratingMap),
      saveJson(usersStore, userLikesKey(hash), likeList),
    ])
  }

  // A rated page is always an impression — make sure it never reappears.
  if (!(Array.isArray(seen) ? seen : []).includes(pageId)) {
    await saveJson(usersStore, userSeenKey(hash), appendSeen(seen, pageId))
  }

  return json({ ok: true, upVotes: page.upVotes || 0, downVotes: page.downVotes || 0 })
}
