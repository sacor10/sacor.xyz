import { readSessionCookie } from './_lib/session.mjs'

export default async (req) => {
  const session = readSessionCookie(req)
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
  return new Response(JSON.stringify({
    user: session,
    googleClientId,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
