import { readSessionCookie, userHash } from './_lib/session.mjs'
import {
  getUsersStore,
  loadJson,
  saveJson,
  normalizeUsername,
  userProfileKey,
  userFollowingKey,
  userFollowersKey,
  usernameKey,
  json,
} from './_lib/stumble.mjs'

const asList = (v) => (Array.isArray(v) ? v : [])
const upsertByHash = (list, entry) => [...list.filter((u) => u.hash !== entry.hash), entry]
const removeByHash = (list, hash) => list.filter((u) => u.hash !== hash)

// POST /follow { username, action: 'follow' | 'unfollow' } — mutate the social
// graph. Updates both sides (my following + their followers). No transactions
// in Blobs, so writes are idempotent and deduped by hash.
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const session = readSessionCookie(req)
  if (!session) return json({ error: 'Sign in to follow people' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const targetName = normalizeUsername(body?.username || '')
  const action = body?.action === 'unfollow' ? 'unfollow' : 'follow'
  if (!targetName) return json({ error: 'username is required' }, { status: 400 })

  const usersStore = getUsersStore()
  const myHash = userHash(session.email)

  const myProfile = await loadJson(usersStore, userProfileKey(myHash), null)
  if (!myProfile?.username) {
    return json({ error: 'Claim a username before following', needsUsername: true }, { status: 409 })
  }

  const ref = await loadJson(usersStore, usernameKey(targetName), null)
  if (!ref?.hash) return json({ error: 'Profile not found' }, { status: 404 })
  const targetHash = ref.hash
  if (targetHash === myHash) return json({ error: "You can't follow yourself" }, { status: 400 })

  const targetProfile = await loadJson(usersStore, userProfileKey(targetHash), null)
  const targetUsername = targetProfile?.username || targetName

  const [following, followers] = await Promise.all([
    loadJson(usersStore, userFollowingKey(myHash), []),
    loadJson(usersStore, userFollowersKey(targetHash), []),
  ])
  let myFollowing = asList(following)
  let theirFollowers = asList(followers)

  if (action === 'follow') {
    myFollowing = upsertByHash(myFollowing, { hash: targetHash, username: targetUsername })
    theirFollowers = upsertByHash(theirFollowers, { hash: myHash, username: myProfile.username })
  } else {
    myFollowing = removeByHash(myFollowing, targetHash)
    theirFollowers = removeByHash(theirFollowers, myHash)
  }

  await Promise.all([
    saveJson(usersStore, userFollowingKey(myHash), myFollowing),
    saveJson(usersStore, userFollowersKey(targetHash), theirFollowers),
  ])

  return json({
    ok: true,
    isFollowing: action === 'follow',
    followerCount: theirFollowers.length,
    followingCount: myFollowing.length,
  })
}
