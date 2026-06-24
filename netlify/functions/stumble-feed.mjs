import { readSessionCookie, userHash } from './_lib/session.mjs'
import {
  getPagesStore,
  getUsersStore,
  loadJson,
  loadPageCard,
  normalizeLikes,
  userFollowingKey,
  userLikesKey,
  json,
} from './_lib/stumble.mjs'

// Bound the fan-out so the feed stays a handful of Blob reads.
const MAX_FOLLOWEES = 50
const FEED_LIMIT = 30

// GET /feed — recent likes from the people the signed-in user follows, newest
// first, each tagged with who liked it. Cached follow lists keep this cheap;
// a per-user social cache is a future optimization (PRD social §).
export default async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })

  const session = readSessionCookie(req)
  if (!session) return json({ error: 'Sign in to see your feed' }, { status: 401 })

  const usersStore = getUsersStore()
  const hash = userHash(session.email)
  const following = await loadJson(usersStore, userFollowingKey(hash), [])
  const followees = (Array.isArray(following) ? following : []).slice(0, MAX_FOLLOWEES)
  if (!followees.length) return json({ items: [], following: 0 })

  const likeLists = await Promise.all(
    followees.map((u) => loadJson(usersStore, userLikesKey(u.hash), [])),
  )

  // Merge every followee's likes; keep the most recent like per page and record
  // who liked it (most recent liker wins the attribution).
  const byId = new Map()
  followees.forEach((u, i) => {
    for (const entry of normalizeLikes(likeLists[i])) {
      const prior = byId.get(entry.id)
      if (!prior || entry.at > prior.at) {
        byId.set(entry.id, { id: entry.id, at: entry.at, by: u.username })
      }
    }
  })

  const ordered = [...byId.values()].sort((a, b) => b.at - a.at).slice(0, FEED_LIMIT)
  const pagesStore = getPagesStore()
  const resolved = await Promise.all(
    ordered.map(async (item) => {
      const card = await loadPageCard(pagesStore, item.id)
      return card ? { ...card, likedBy: item.by, likedAt: item.at } : null
    }),
  )

  return json({ items: resolved.filter(Boolean), following: followees.length })
}
