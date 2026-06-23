import { readSessionCookie, userHash } from './_lib/session.mjs'
import {
  getUsersStore,
  loadJson,
  saveJson,
  userInterestsKey,
  userLikesKey,
  json,
} from './_lib/stumble.mjs'
import {
  stumbleInterests,
  isKnownInterest,
  MIN_INTERESTS,
} from '../../src/data/stumbleInterests.js'

// GET  /interests          — list the interest catalog (+ the signed-in user's
//                            current selection, for onboarding).
// PUT  /users/me/interests — save the signed-in user's interests (PRD §6.1, §8).
export default async (req) => {
  const session = readSessionCookie(req)

  if (req.method === 'GET') {
    let selected = []
    let likesCount = 0
    if (session) {
      const usersStore = getUsersStore()
      const hash = userHash(session.email)
      const [stored, likes] = await Promise.all([
        loadJson(usersStore, userInterestsKey(hash), []),
        loadJson(usersStore, userLikesKey(hash), []),
      ])
      if (Array.isArray(stored)) selected = stored.filter(isKnownInterest)
      if (Array.isArray(likes)) likesCount = likes.length
    }
    return json({
      interests: stumbleInterests,
      selected,
      minInterests: MIN_INTERESTS,
      likesCount,
    })
  }

  if (req.method === 'PUT') {
    if (!session) return json({ error: 'Sign in to save interests' }, { status: 401 })
    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const raw = Array.isArray(body?.interests) ? body.interests : []
    const cleaned = [
      ...new Set(raw.filter((s) => typeof s === 'string').filter(isKnownInterest)),
    ]
    if (cleaned.length < MIN_INTERESTS) {
      return json({ error: `Pick at least ${MIN_INTERESTS} interests` }, { status: 400 })
    }
    await saveJson(getUsersStore(), userInterestsKey(userHash(session.email)), cleaned)
    return json({ ok: true, selected: cleaned })
  }

  return new Response('Method Not Allowed', { status: 405 })
}
