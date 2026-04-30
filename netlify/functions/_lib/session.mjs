import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'sacor_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromB64url = (str) => Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

const getSecret = () => {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET env var is missing or too short (need 16+ chars)')
  }
  return secret
}

export function signSession({ email, isOwner }) {
  const payload = { email, isOwner: !!isOwner, exp: Date.now() + SESSION_TTL_MS }
  const body = b64url(JSON.stringify(payload))
  const mac = createHmac('sha256', getSecret()).update(body).digest()
  return `${body}.${b64url(mac)}`
}

export function verifySession(token) {
  if (!token || typeof token !== 'string') return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', getSecret()).update(body).digest()
  const got = fromB64url(sig)
  if (got.length !== expected.length) return null
  if (!timingSafeEqual(got, expected)) return null
  let payload
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8'))
  } catch {
    return null
  }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
  return { email: payload.email, isOwner: !!payload.isOwner }
}

export function readSessionCookie(req) {
  const header = req.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === COOKIE_NAME) return verifySession(rest.join('='))
  }
  return null
}

export function setSessionCookieHeader(token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`
}

export function clearSessionCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
}

export function requireOwner(req) {
  const session = readSessionCookie(req)
  if (!session) return { error: new Response('Unauthorized', { status: 401 }) }
  if (!session.isOwner) return { error: new Response('Forbidden', { status: 403 }) }
  return { session }
}
