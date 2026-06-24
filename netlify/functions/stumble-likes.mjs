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
  userLikesKey,
  summaryOf,
  domainOf,
  normalizeLikes,
  json,
} from './_lib/stumble.mjs'

// Browser-facing shape of a liked page (just enough to render a row + link).
const likeRow = (page) => ({
  id: page.id,
  url: page.url,
  title: String(page.title || domainOf(page.url) || 'Untitled stumble').trim(),
  domain: page.domain || domainOf(page.url),
})

// GET    /likes — list the signed-in user's liked pages (newest first).
// DELETE /likes — remove a like cleanly (no downvote), body { pageId }.
export default async (req) => {
  const session = readSessionCookie(req)

  if (req.method === 'GET') {
    if (!session) return json({ likes: [], likesCount: 0 })

    const usersStore = getUsersStore()
    const pagesStore = getPagesStore()
    const hash = userHash(session.email)
    const likes = await loadJson(usersStore, userLikesKey(hash), [])
    // Likes are stored as { id, at } (legacy bare-id entries normalize to at:0);
    // resolve newest-first by like time.
    const ordered = normalizeLikes(likes).sort((a, b) => b.at - a.at)

    // Resolve each id to its page record; drop any that have since vanished.
    const rows = await Promise.all(
      ordered.map(async (entry) => {
        const raw = await pagesStore.get(pageKey(entry.id))
        if (!raw) return null
        try {
          return likeRow(JSON.parse(raw))
        } catch {
          return null
        }
      }),
    )
    const resolved = rows.filter(Boolean)
    return json({ likes: resolved, likesCount: resolved.length })
  }

  if (req.method === 'DELETE') {
    if (!session) return json({ error: 'Sign in to manage likes' }, { status: 401 })

    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const pageId = typeof body?.pageId === 'string' ? body.pageId : ''
    if (!pageId) return json({ error: 'pageId is required' }, { status: 400 })

    const usersStore = getUsersStore()
    const pagesStore = getPagesStore()
    const hash = userHash(session.email)
    const [ratings, likes] = await Promise.all([
      loadJson(usersStore, userRatingsKey(hash), {}),
      loadJson(usersStore, userLikesKey(hash), []),
    ])
    const ratingMap = ratings && typeof ratings === 'object' ? ratings : {}
    const likeList = normalizeLikes(likes)

    const idx = likeList.findIndex((e) => e.id === pageId)
    if (idx >= 0) likeList.splice(idx, 1)

    // If the page was up-voted, take that vote back so counts stay honest, then
    // clear the rating so the page can resurface like any other.
    if (ratingMap[pageId] === 1) {
      const raw = await pagesStore.get(pageKey(pageId))
      if (raw) {
        try {
          const page = JSON.parse(raw)
          page.upVotes = Math.max(0, (page.upVotes || 0) - 1)
          await pagesStore.set(pageKey(pageId), JSON.stringify(page))
          const index = await loadApprovedIndex(pagesStore)
          const at = index.findIndex((s) => s.id === pageId)
          if (at >= 0) {
            index[at] = summaryOf(page)
            await saveJson(pagesStore, APPROVED_INDEX_KEY, index)
          }
        } catch {
          /* page record unreadable — still drop the like below */
        }
      }
      delete ratingMap[pageId]
    }

    await Promise.all([
      saveJson(usersStore, userRatingsKey(hash), ratingMap),
      saveJson(usersStore, userLikesKey(hash), likeList),
    ])

    // Return the refreshed list so the client can re-render in one round trip.
    const rows = await Promise.all(
      [...likeList].sort((a, b) => b.at - a.at).map(async (entry) => {
        const raw = await pagesStore.get(pageKey(entry.id))
        if (!raw) return null
        try {
          return likeRow(JSON.parse(raw))
        } catch {
          return null
        }
      }),
    )
    const resolved = rows.filter(Boolean)
    return json({ ok: true, likes: resolved, likesCount: resolved.length })
  }

  return new Response('Method Not Allowed', { status: 405 })
}
