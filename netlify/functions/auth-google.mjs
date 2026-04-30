import { canAccessTravelPlans, normalizeEmail, signSession, setSessionCookieHeader } from './_lib/session.mjs'

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  })

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const credential = body?.credential
  if (!credential || typeof credential !== 'string') {
    return json({ error: 'Missing credential' }, { status: 400 })
  }

  const expectedAud = process.env.GOOGLE_CLIENT_ID
  if (!expectedAud) {
    return json({ error: 'Server misconfigured: GOOGLE_CLIENT_ID' }, { status: 500 })
  }

  const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
  const resp = await fetch(tokenInfoUrl)
  if (!resp.ok) {
    return json({ error: 'Invalid Google token' }, { status: 401 })
  }
  const claims = await resp.json()

  if (claims.aud !== expectedAud) {
    return json({ error: 'Token audience mismatch' }, { status: 401 })
  }
  if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') {
    return json({ error: 'Invalid issuer' }, { status: 401 })
  }
  if (claims.email_verified !== 'true' && claims.email_verified !== true) {
    return json({ error: 'Email not verified' }, { status: 401 })
  }
  const expSec = Number(claims.exp)
  if (!expSec || expSec * 1000 < Date.now()) {
    return json({ error: 'Token expired' }, { status: 401 })
  }

  const email = normalizeEmail(claims.email)
  if (!email) {
    return json({ error: 'Missing Google email' }, { status: 401 })
  }
  const travelAccess = canAccessTravelPlans(email)

  const token = signSession({ email })
  return json(
    { email, canAccessTravelPlans: travelAccess, isOwner: travelAccess },
    {
      headers: {
        'Set-Cookie': setSessionCookieHeader(token),
      },
    },
  )
}
