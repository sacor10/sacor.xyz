import { createHash } from 'node:crypto'
import { readSessionCookie, userHash } from './_lib/session.mjs'
import {
  PENDING_INDEX_KEY,
  canonicalizeUrl,
  domainOf,
  getPagesStore,
  inferContentType,
  json,
  loadApprovedIndex,
  loadJson,
  moderationSummaryOf,
  normalizeContentType,
  normalizeFramePolicy,
  normalizeInterests,
  normalizePageRecord,
  pageIdForUrl,
  pageKey,
  saveJson,
  submitterRateKey,
  upsertSummary,
} from './_lib/stumble.mjs'

const DAILY_SUBMISSION_LIMIT = 8
const FETCH_TIMEOUT_MS = 6500
const MAX_METADATA_BYTES = 1_000_000

const USER_AGENT = 'sacor.xyz Stumble preview bot (+https://sacor.xyz/stumble)'

const hashString = (value) => createHash('sha256').update(String(value || '')).digest('hex')

function clientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for') || ''
  return (
    req.headers.get('cf-connecting-ip') ||
    forwarded.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function submissionHash(req, session) {
  if (session?.email) return `user-${userHash(session.email)}`
  return `ip-${hashString(clientIp(req)).slice(0, 32)}`
}

function dayKey() {
  return new Date().toISOString().slice(0, 10)
}

async function checkRateLimit(store, hash) {
  const key = submitterRateKey(hash, dayKey())
  const current = await loadJson(store, key, { count: 0 })
  const count = Number(current?.count || 0)
  if (count >= DAILY_SUBMISSION_LIMIT) return false
  await saveJson(store, key, { count: count + 1, updatedAt: new Date().toISOString() })
  return true
}

function attr(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const match = tag.match(pattern)
  return match ? match[2] || match[3] || match[4] || '' : ''
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function firstMeta(html, names) {
  for (const tag of html.match(/<meta\s+[^>]*>/gi) || []) {
    const key = (attr(tag, 'property') || attr(tag, 'name')).toLowerCase()
    if (names.includes(key)) return decodeEntities(attr(tag, 'content'))
  }
  return ''
}

function firstCanonical(html, baseUrl) {
  for (const tag of html.match(/<link\s+[^>]*>/gi) || []) {
    const rel = attr(tag, 'rel').toLowerCase()
    if (!rel.split(/\s+/).includes('canonical')) continue
    const href = attr(tag, 'href')
    if (!href) continue
    try {
      return canonicalizeUrl(new URL(href, baseUrl).toString())
    } catch {
      return null
    }
  }
  return null
}

function titleOf(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return decodeEntities(match?.[1] || '')
}

function framePolicyFromHeaders(headers) {
  const xfo = headers.get('x-frame-options')
  const csp = headers.get('content-security-policy') || ''
  if (xfo) return 'block'
  if (/frame-ancestors\s+[^;]+/i.test(csp)) return 'block'
  return 'unknown'
}

async function fetchMetadata(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': USER_AGENT,
      },
    })
    const framePolicy = framePolicyFromHeaders(res.headers)
    const lastCheckedAt = new Date().toISOString()
    if (!res.ok) return { framePolicy, lastCheckedAt }

    const contentType = res.headers.get('content-type') || ''
    const contentLength = Number(res.headers.get('content-length') || 0)
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return { framePolicy, lastCheckedAt }
    }
    if (contentLength > MAX_METADATA_BYTES) {
      return { framePolicy, lastCheckedAt }
    }

    const html = await res.text()
    return {
      title: firstMeta(html, ['og:title', 'twitter:title']) || titleOf(html),
      description: firstMeta(html, ['og:description', 'description', 'twitter:description']),
      thumbnailUrl: firstMeta(html, ['og:image', 'twitter:image']) || null,
      canonicalUrl: firstCanonical(html, url),
      framePolicy,
      lastCheckedAt,
    }
  } catch {
    return { framePolicy: 'unknown', lastCheckedAt: new Date().toISOString() }
  } finally {
    clearTimeout(timer)
  }
}

function trimText(value, max) {
  return String(value || '').trim().slice(0, max)
}

function isSameRegistrableHost(a, b) {
  return domainOf(a) === domainOf(b)
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const inputUrl = canonicalizeUrl(body?.url)
  if (!inputUrl) return json({ error: 'Submit a valid http(s) URL' }, { status: 400 })

  const pagesStore = getPagesStore()
  const session = readSessionCookie(req)
  const hash = submissionHash(req, session)
  const allowed = await checkRateLimit(pagesStore, hash)
  if (!allowed) return json({ error: 'Submission limit reached for today' }, { status: 429 })

  const [approvedIndex, pendingIndex] = await Promise.all([
    loadApprovedIndex(pagesStore),
    loadJson(pagesStore, PENDING_INDEX_KEY, []),
  ])

  const inputId = pageIdForUrl(inputUrl)
  if (approvedIndex.some((summary) => summary.id === inputId)) {
    return json({ error: 'That site is already in the stumble pool' }, { status: 409 })
  }
  if (pendingIndex.some((summary) => summary.id === inputId)) {
    return json({ ok: true, status: 'pending', duplicate: true }, { status: 202 })
  }

  const metadata = await fetchMetadata(inputUrl)
  const metadataCanonical = canonicalizeUrl(metadata.canonicalUrl)
  const canonicalUrl =
    metadataCanonical && isSameRegistrableHost(inputUrl, metadataCanonical) ? metadataCanonical : inputUrl
  const id = pageIdForUrl(canonicalUrl)

  if (approvedIndex.some((summary) => summary.id === id)) {
    return json({ error: 'That site is already in the stumble pool' }, { status: 409 })
  }
  if (pendingIndex.some((summary) => summary.id === id)) {
    return json({ ok: true, status: 'pending', duplicate: true }, { status: 202 })
  }

  const submittedInterests = normalizeInterests(body?.interests).slice(0, 6)
  const draft = normalizePageRecord({
    id,
    url: canonicalUrl,
    canonicalUrl,
    title: trimText(body?.title, 140) || trimText(metadata.title, 140) || domainOf(canonicalUrl),
    description: trimText(metadata.description, 280),
    thumbnailUrl: metadata.thumbnailUrl || null,
    interests: submittedInterests,
    contentType: normalizeContentType(body?.contentType, inferContentType({ url: canonicalUrl, interests: submittedInterests })),
    language: 'en',
    source: 'community-submission',
    status: 'pending',
    qualityScore: 0.55,
    safetyFlags: [],
    framePolicy: normalizeFramePolicy(metadata.framePolicy),
    submittedBy: session?.email ? `user:${session.email}` : 'guest',
    submitterHash: hash,
    submitterNote: trimText(body?.note, 500),
    submittedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    lastCheckedAt: metadata.lastCheckedAt || null,
  })

  await pagesStore.set(pageKey(id), JSON.stringify(draft))
  const nextPending = Array.isArray(pendingIndex) ? [...pendingIndex] : []
  upsertSummary(nextPending, moderationSummaryOf(draft))
  await saveJson(pagesStore, PENDING_INDEX_KEY, nextPending)

  return json({ ok: true, status: 'pending', id })
}
