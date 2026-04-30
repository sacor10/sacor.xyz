import { clearSessionCookieHeader } from './_lib/session.mjs'

export default async () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': clearSessionCookieHeader(),
    },
  })
