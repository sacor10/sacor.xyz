import { readSessionCookie } from './_lib/session.mjs'

export default async (req) => {
  const session = readSessionCookie(req)
  return new Response(JSON.stringify({
    user: session,
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
