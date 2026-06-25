import { readSessionCookie, userHash } from './_lib/session.mjs'
import {
  getPagesStore,
  getUsersStore,
  loadJson,
  saveJson,
  loadPageCard,
  normalizeLikes,
  normalizeUsername,
  usernameError,
  userProfileKey,
  userLikesKey,
  userFollowingKey,
  userFollowersKey,
  usernameKey,
  json,
} from './_lib/stumble.mjs'

// How many of a profile's most-recent likes to resolve into cards per request.
const PROFILE_LIKES_LIMIT = 60

const followCount = (list) => (Array.isArray(list) ? list.length : 0)

// Resolve a profile's most recent likes to browser-facing cards (newest first).
async function recentLikedCards(pagesStore, likes, limit) {
  const ordered = normalizeLikes(likes)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
  const cards = await Promise.all(ordered.map((entry) => loadPageCard(pagesStore, entry.id)))
  return cards.filter(Boolean)
}

// GET  /profile?username=foo — public profile (likedPages only when signed in).
// GET  /profile              — the signed-in caller's own profile + counts.
// PUT  /profile { username } — claim a handle (immutable in v1; PRD social §).
export default async (req) => {
  const session = readSessionCookie(req)
  const usersStore = getUsersStore()

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const wanted = normalizeUsername(url.searchParams.get('username') || '')

    // No username → "who am I": lets the UI know whether to prompt a claim.
    if (!wanted) {
      if (!session) return json({ signedIn: false, username: null })
      const hash = userHash(session.email)
      const [profile, following, followers] = await Promise.all([
        loadJson(usersStore, userProfileKey(hash), null),
        loadJson(usersStore, userFollowingKey(hash), []),
        loadJson(usersStore, userFollowersKey(hash), []),
      ])
      return json({
        signedIn: true,
        username: profile?.username || null,
        followingCount: followCount(following),
        followerCount: followCount(followers),
      })
    }

    const ref = await loadJson(usersStore, usernameKey(wanted), null)
    if (!ref?.hash) return json({ error: 'Profile not found' }, { status: 404 })
    const targetHash = ref.hash

    const [profile, following, followers] = await Promise.all([
      loadJson(usersStore, userProfileKey(targetHash), null),
      loadJson(usersStore, userFollowingKey(targetHash), []),
      loadJson(usersStore, userFollowersKey(targetHash), []),
    ])

    const out = {
      username: profile?.username || wanted,
      followingCount: followCount(following),
      followerCount: followCount(followers),
      following: (Array.isArray(following) ? following : []).map((u) => ({
        username: u.username,
      })),
      followers: (Array.isArray(followers) ? followers : []).map((u) => ({
        username: u.username,
      })),
      isSelf: false,
      isFollowing: false,
    }

    // Likes (and who-follows-whom flags) require a signed-in viewer.
    if (!session) {
      return json({ ...out, signInRequired: true, likedPages: [] })
    }
    const viewerHash = userHash(session.email)
    out.isSelf = viewerHash === targetHash
    if (!out.isSelf) {
      const viewerFollowing = await loadJson(usersStore, userFollowingKey(viewerHash), [])
      out.isFollowing = (Array.isArray(viewerFollowing) ? viewerFollowing : []).some(
        (u) => u.hash === targetHash,
      )
    }
    const likes = await loadJson(usersStore, userLikesKey(targetHash), [])
    out.likedPages = await recentLikedCards(getPagesStore(), likes, PROFILE_LIKES_LIMIT)
    return json(out)
  }

  if (req.method === 'PUT') {
    if (!session) return json({ error: 'Sign in to claim a username' }, { status: 401 })
    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const username = normalizeUsername(body?.username || '')
    const invalidReason = usernameError(username)
    if (invalidReason) {
      return json({ error: invalidReason }, { status: 400 })
    }

    const hash = userHash(session.email)
    const existing = await loadJson(usersStore, userProfileKey(hash), null)
    if (existing?.username) {
      // Usernames are immutable in v1.
      if (existing.usernameLower === username) {
        return json({ ok: true, username: existing.username })
      }
      return json({ error: 'You already claimed a username.' }, { status: 409 })
    }

    // Best-effort uniqueness: Blobs has no transactions, so there is a small
    // race window. Acceptable at this site's scale; last writer would win.
    const taken = await loadJson(usersStore, usernameKey(username), null)
    if (taken?.hash && taken.hash !== hash) {
      return json({ error: 'That username is taken.' }, { status: 409 })
    }

    const profile = { username, usernameLower: username, createdAt: new Date().toISOString() }
    await Promise.all([
      saveJson(usersStore, usernameKey(username), { hash }),
      saveJson(usersStore, userProfileKey(hash), profile),
    ])
    return json({ ok: true, username })
  }

  return new Response('Method Not Allowed', { status: 405 })
}
