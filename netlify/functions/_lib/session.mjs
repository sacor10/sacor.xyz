import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'sacor_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromB64url = (str) => Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

export function getTravelPlanEmails() {
  const raw = process.env.TRAVEL_PLAN_EMAILS || process.env.OWNER_EMAIL || ''
  return raw
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean)
}

export function canAccessTravelPlans(email) {
  return !!normalizeEmail(email)
}

export function canCreateTravelPlans(email) {
  return isOwnerEmail(email)
}

export function isOwnerEmail(email) {
  const normalized = normalizeEmail(email)
  return !!normalized && getTravelPlanEmails().includes(normalized)
}

export function userHash(email) {
  const normalized = normalizeEmail(email)
  if (!normalized) throw new Error('userHash requires an email')
  return createHash('sha256').update(normalized).digest('hex')
}

export function userKeyPrefix(email) {
  return `users/${userHash(email)}`
}

export function userKeyPrefixFromHash(hash) {
  const normalized = String(hash || '').trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(normalized)) return null
  return `users/${normalized}`
}

const getSecret = () => {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET env var is missing or too short (need 16+ chars)')
  }
  return secret
}

export function signSession({ email }) {
  const payload = { email: normalizeEmail(email), exp: Date.now() + SESSION_TTL_MS }
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
  const email = normalizeEmail(payload.email)
  if (!email) return null
  return {
    email,
    canAccessTravelPlans: canAccessTravelPlans(email),
    canCreateTravelPlans: canCreateTravelPlans(email),
    isOwner: isOwnerEmail(email),
  }
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

export function requireTravelAccess(req) {
  const session = readSessionCookie(req)
  if (!session) return { error: new Response('Unauthorized', { status: 401 }) }
  if (!canAccessTravelPlans(session.email)) {
    return { error: new Response('Forbidden', { status: 403 }) }
  }
  return { session }
}
