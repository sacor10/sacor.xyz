import { readSessionCookie } from './_lib/session.mjs'
import { isModeratorEmail } from './_lib/moderators.mjs'
import { getUsersStore } from './_lib/stumble.mjs'

export default async (req) => {
  const session = readSessionCookie(req)
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
  // Moderator status is computed live from the blob roster (not baked into the
  // session cookie) so adding/removing a moderator takes effect immediately.
  const user = session
    ? { ...session, isModerator: await isModeratorEmail(getUsersStore(), session.email) }
    : null
  return new Response(JSON.stringify({
    user,
    googleClientId,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
