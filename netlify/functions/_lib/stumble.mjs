import { getStore } from '@netlify/blobs'
import { createHash } from 'node:crypto'
import { stumbleSeedPages } from '../../../src/data/stumblePages.js'
import { isKnownInterest } from '../../../src/data/stumbleInterests.js'
import { siteSlug } from '../../../src/lib/stumbleSlug.js'

// Shared helpers for the /stumble Netlify Functions. Mirrors the Blobs + index
// conventions used by travel-plans.mjs.

export const PAGES_STORE = 'stumble-pages'
export const USERS_STORE = 'stumble-users'

// Strong consistency gives read-your-writes within a single request, which the
// read-modify-write flows here depend on (likes, ratings, follows, the approved
// index, vote counts). Under the default eventual consistency a delete can read
// a stale list and resurrect an entry that a prior delete just removed — the
// classic "unlike leaves one like, alternating between them" bug.
export const getPagesStore = () => getStore({ name: PAGES_STORE, consistency: 'strong' })
export const getUsersStore = () => getStore({ name: USERS_STORE, consistency: 'strong' })

export const APPROVED_INDEX_KEY = 'index/approved'
export const PENDING_INDEX_KEY = 'index/pending'
export const REJECTED_INDEX_KEY = 'index/rejected'
export const SEED_VERSION = 4
export const SEED_VERSION_KEY = 'index/seed-version'
export const pageKey = (id) => `pages/${id}`
export const submitterRateKey = (hash, day) => `rate/submissions/${day}/${hash}`
export const userInterestsKey = (hash) => `users/${hash}/interests`
export const userSeenKey = (hash) => `users/${hash}/seen`
export const userRatingsKey = (hash) => `users/${hash}/ratings`
export const userLikesKey = (hash) => `users/${hash}/likes`
export const userProfileKey = (hash) => `users/${hash}/profile`
export const userFollowingKey = (hash) => `users/${hash}/following`
export const userFollowersKey = (hash) => `users/${hash}/followers`
export const usernameKey = (usernameLower) => `usernames/${usernameLower}`

// Cap the per-user "already seen" list so it can't grow without bound.
export const SEEN_CAP = 500

export const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  })

export const loadJson = async (store, key, fallback) => {
  const raw = await store.get(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export const saveJson = (store, key, value) => store.set(key, JSON.stringify(value))

// --- Social identity: usernames + likes shape ------------------------------

// A small set of names we never let users claim, so handles can't impersonate
// app routes/roles. Compared against the lowercased handle.
const RESERVED_USERNAMES = new Set([
  'me', 'admin', 'owner', 'root', 'mod', 'moderator', 'staff', 'system',
  'stumble', 'stumbleupon', 'sacor', 'user', 'users', 'profile', 'profiles',
  'following', 'followers', 'feed', 'about', 'help', 'support', 'api',
  'null', 'undefined', 'anonymous', 'guest',
])

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export const normalizeUsername = (input) => String(input || '').trim().toLowerCase()

export function isValidUsername(input) {
  const u = normalizeUsername(input)
  return USERNAME_RE.test(u) && !RESERVED_USERNAMES.has(u)
}

// Returns a human-facing reason a handle can't be claimed, or null if it's
// fine. Kept separate from isValidUsername so callers can tell a malformed
// handle (wrong characters/length) apart from a reserved one and message
// accordingly — they fail for very different reasons.
export function usernameError(input) {
  const u = normalizeUsername(input)
  if (!USERNAME_RE.test(u)) {
    return '3–20 characters: lowercase letters, numbers, or underscores.'
  }
  if (RESERVED_USERNAMES.has(u)) {
    return 'That username is reserved. Please choose another.'
  }
  return null
}

// Likes evolved from bare pageId strings to { id, at } objects so the feed can
// sort by recency. Reads stay backward-compatible: a legacy string entry maps
// to { id, at: 0 }. De-duped by id, newest-write-wins on `at`.
export function normalizeLikes(likes) {
  if (!Array.isArray(likes)) return []
  const byId = new Map()
  for (const entry of likes) {
    const id = typeof entry === 'string' ? entry : entry?.id
    if (!id) continue
    const at = typeof entry === 'object' && Number.isFinite(entry?.at) ? entry.at : 0
    const prior = byId.get(id)
    if (!prior || at > prior.at) byId.set(id, { id, at })
  }
  return [...byId.values()]
}

export const likeIds = (likes) => normalizeLikes(likes).map((entry) => entry.id)

// --- URL hygiene (PRD §9: validate, canonicalize, dedup) -------------------

const TRACKING_PARAM = /^(utm_.*|fbclid|gclid|dclid|mc_eid|mc_cid|ref|ref_src|igshid|si)$/i

export function domainOf(input) {
  try {
    return new URL(String(input || '')).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function canonicalizeUrl(input) {
  let u
  try {
    u = new URL(String(input || '').trim())
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  u.hash = ''
  u.hostname = u.hostname.toLowerCase()
  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
    u.port = ''
  }
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) u.searchParams.delete(key)
  }
  u.searchParams.sort()
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '')
  return u.toString()
}

export const pageIdForUrl = (canonicalUrl) =>
  createHash('sha256').update(canonicalUrl).digest('hex').slice(0, 16)

const FRAME_POLICIES = new Set(['allow', 'block', 'unknown'])
export const CONTENT_TYPES = new Set([
  'archive',
  'article',
  'audio',
  'book',
  'collection',
  'course',
  'gallery',
  'game',
  'interactive',
  'map',
  'museum',
  'recipe',
  'reference',
  'tool',
  'video',
])

export const normalizeFramePolicy = (policy) =>
  FRAME_POLICIES.has(policy) ? policy : 'unknown'

export const normalizeContentType = (type, fallback = 'article') =>
  CONTENT_TYPES.has(type) ? type : fallback

export function inferContentType(page = {}) {
  if (CONTENT_TYPES.has(page.contentType)) return page.contentType
  const interests = new Set(page.interests || [])
  const url = String(page.url || '')
  if (interests.has('gaming')) return 'game'
  if (interests.has('maps')) return 'map'
  if (interests.has('museums')) return 'museum'
  if (interests.has('archives')) return 'archive'
  if (interests.has('tools')) return 'tool'
  if (interests.has('books')) return 'book'
  if (interests.has('food') && /recipe/i.test(`${page.title || ''} ${url}`)) return 'recipe'
  if (interests.has('interactives') || /experiment|interactive|lab|fun/i.test(url)) return 'interactive'
  if (interests.has('photography') || interests.has('art')) return 'gallery'
  if (interests.has('learning')) return 'course'
  return 'article'
}

export const qualityScore = (value, fallback = 0.75) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(1, n))
}

export function normalizeInterests(interests) {
  return [...new Set((Array.isArray(interests) ? interests : []).filter(isKnownInterest))]
}

export function normalizePageRecord(page = {}) {
  const canonicalUrl = canonicalizeUrl(page.canonicalUrl || page.url)
  const url = page.url || canonicalUrl || ''
  const interests = normalizeInterests(page.interests)
  const now = new Date().toISOString()
  const status = page.status || 'approved'
  return {
    ...page,
    id: page.id || (canonicalUrl ? pageIdForUrl(canonicalUrl) : ''),
    url,
    canonicalUrl,
    domain: page.domain || domainOf(canonicalUrl || url),
    title: String(page.title || domainOf(url) || 'Untitled stumble').trim(),
    description: String(page.description || '').trim(),
    thumbnailUrl: page.thumbnailUrl || null,
    interests,
    contentType: normalizeContentType(page.contentType, inferContentType({ ...page, interests })),
    language: page.language || 'en',
    source: page.source || (page.submittedBy === 'seed' ? 'curated-seed' : 'community'),
    status,
    qualityScore: qualityScore(page.qualityScore),
    safetyFlags: Array.isArray(page.safetyFlags) ? page.safetyFlags : [],
    framePolicy: normalizeFramePolicy(page.framePolicy),
    upVotes: page.upVotes || 0,
    downVotes: page.downVotes || 0,
    submittedBy: page.submittedBy || page.source || 'unknown',
    submittedAt: page.submittedAt || page.createdAt || now,
    approvedAt: page.approvedAt || (status === 'approved' ? page.createdAt || now : null),
    createdAt: page.createdAt || now,
    lastCheckedAt: page.lastCheckedAt || null,
  }
}

// --- Index summaries -------------------------------------------------------

export const summaryOf = (page) => {
  const normalized = normalizePageRecord(page)
  return {
    id: normalized.id,
    // The /stumble/<slug> path segment, stored so a refresh / direct link can
    // resolve back to this specific page (stumble-page.mjs) without scanning
    // every page record for its title.
    slug: siteSlug(normalized),
    canonicalUrl: normalized.canonicalUrl,
    domain: normalized.domain,
    interests: normalized.interests,
    contentType: normalized.contentType,
    qualityScore: normalized.qualityScore,
    framePolicy: normalized.framePolicy,
    upVotes: normalized.upVotes,
    downVotes: normalized.downVotes,
    createdAt: normalized.createdAt,
    approvedAt: normalized.approvedAt,
  }
}

export const moderationSummaryOf = (page) => {
  const normalized = normalizePageRecord(page)
  return {
    id: normalized.id,
    canonicalUrl: normalized.canonicalUrl,
    domain: normalized.domain,
    title: normalized.title,
    status: normalized.status,
    submittedAt: normalized.submittedAt,
  }
}

// Browser-facing shape of a page (omits moderation/internal fields).
export const clientPage = (page) => ({
  id: page.id,
  url: page.url,
  title: page.title,
  description: page.description || '',
  thumbnailUrl: page.thumbnailUrl || null,
  interests: page.interests || [],
  contentType: normalizeContentType(page.contentType, inferContentType(page)),
  upVotes: page.upVotes || 0,
  downVotes: page.downVotes || 0,
  framePolicy: normalizeFramePolicy(page.framePolicy),
})

// Find an approved-index summary by its /stumble/<slug> segment. Matched
// case-insensitively so a hand-typed or lower-cased URL still resolves. Returns
// null when no page slugs to that value.
export function findSummaryBySlug(index, slug) {
  const want = String(slug || '').toLowerCase()
  if (!want) return null
  return (Array.isArray(index) ? index : []).find(
    (s) => String(s?.slug || '').toLowerCase() === want,
  ) || null
}

// Resolve a stored pageId to its browser-facing card, or null if the page is
// gone or no longer approved (so a liked page that got pulled won't resurface).
export async function loadPageCard(pagesStore, id) {
  const raw = await pagesStore.get(pageKey(id))
  if (!raw) return null
  let page
  try {
    page = JSON.parse(raw)
  } catch {
    return null
  }
  if (page.status && page.status !== 'approved') return null
  return clientPage(page)
}

// --- Seeding (lazy, like seedIfEmpty in travel-plans.mjs) ------------------

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function pageFromSeed(seed, canonicalUrl, id, now, existing = {}) {
  return normalizePageRecord({
    ...existing,
    id,
    url: seed.url,
    canonicalUrl,
    domain: domainOf(canonicalUrl),
    title: seed.title,
    description: seed.description || '',
    thumbnailUrl: seed.thumbnailUrl ?? existing.thumbnailUrl ?? null,
    interests: normalizeInterests(seed.interests),
    contentType: seed.contentType || existing.contentType,
    language: seed.language || existing.language || 'en',
    source: seed.source || existing.source || 'curated-seed',
    framePolicy: normalizeFramePolicy(seed.framePolicy),
    status: 'approved',
    qualityScore: qualityScore(seed.qualityScore, existing.qualityScore ?? 0.78),
    safetyFlags: seed.safetyFlags || existing.safetyFlags || [],
    upVotes: existing.upVotes || 0,
    downVotes: existing.downVotes || 0,
    submittedBy: 'seed',
    submittedAt: existing.submittedAt || existing.createdAt || now,
    approvedAt: existing.approvedAt || existing.createdAt || now,
    createdAt: existing.createdAt || now,
    lastCheckedAt: existing.lastCheckedAt || null,
  })
}

export function upsertSummary(index, summary) {
  const idx = index.findIndex((item) => item.id === summary.id)
  if (idx === -1) {
    index.push(summary)
    return true
  }
  if (!sameJson(index[idx], summary)) {
    index[idx] = summary
    return true
  }
  return false
}

export function removeSummary(index, id) {
  const idx = index.findIndex((item) => item.id === id)
  if (idx === -1) return false
  index.splice(idx, 1)
  return true
}

function summaryNeedsMigration(summary) {
  return (
    !summary ||
    !summary.slug ||
    !summary.canonicalUrl ||
    !summary.domain ||
    !summary.contentType ||
    typeof summary.qualityScore !== 'number' ||
    !summary.framePolicy ||
    !summary.approvedAt
  )
}

async function normalizeApprovedIndex(store, existingIndex = []) {
  const index = []
  let changed = false

  for (const summary of existingIndex) {
    if (!summary?.id) {
      changed = true
      continue
    }
    if (!summaryNeedsMigration(summary)) {
      index.push(summary)
      continue
    }

    const raw = await store.get(pageKey(summary.id))
    if (!raw) {
      changed = true
      continue
    }

    let page
    try {
      page = JSON.parse(raw)
    } catch {
      changed = true
      continue
    }

    const normalized = normalizePageRecord(page)
    if (!sameJson(page, normalized)) {
      await store.set(pageKey(normalized.id), JSON.stringify(normalized))
    }
    index.push(summaryOf(normalized))
    changed = true
  }

  if (changed) await saveJson(store, APPROVED_INDEX_KEY, index)
  return index
}

async function upsertSeedPool(store, existingIndex = []) {
  const now = new Date().toISOString()
  const index = Array.isArray(existingIndex) ? [...existingIndex] : []
  let indexChanged = false

  for (const seed of stumbleSeedPages) {
    const canonicalUrl = canonicalizeUrl(seed.url)
    if (!canonicalUrl) continue

    const id = pageIdForUrl(canonicalUrl)
    const raw = await store.get(pageKey(id))

    if (raw) {
      let existing
      try {
        existing = JSON.parse(raw)
      } catch {
        existing = null
      }

      if (existing && existing.submittedBy !== 'seed') {
        if (existing.status === 'approved') {
          indexChanged = upsertSummary(index, summaryOf(existing)) || indexChanged
        }
        continue
      }

      const page = pageFromSeed(seed, canonicalUrl, id, now, existing || {})
      if (!existing || !sameJson(existing, page)) {
        await store.set(pageKey(id), JSON.stringify(page))
      }
      indexChanged = upsertSummary(index, summaryOf(page)) || indexChanged
      continue
    }

    const page = pageFromSeed(seed, canonicalUrl, id, now)
    await store.set(pageKey(id), JSON.stringify(page))
    indexChanged = upsertSummary(index, summaryOf(page)) || indexChanged
  }

  const normalizedIndex = await normalizeApprovedIndex(store, index)

  if (
    indexChanged ||
    !sameJson(index, normalizedIndex) ||
    !Array.isArray(existingIndex) ||
    existingIndex.length === 0
  ) {
    await saveJson(store, APPROVED_INDEX_KEY, normalizedIndex)
  }
  await saveJson(store, SEED_VERSION_KEY, SEED_VERSION)
  return normalizedIndex
}

async function seedApprovedPool(store) {
  return upsertSeedPool(store, [])
}

export async function loadApprovedIndex(store) {
  const index = await loadJson(store, APPROVED_INDEX_KEY, null)
  if (Array.isArray(index) && index.length > 0) {
    const seedVersion = Number(await loadJson(store, SEED_VERSION_KEY, 0))
    if (seedVersion >= SEED_VERSION && !index.some(summaryNeedsMigration)) return index
    if (seedVersion >= SEED_VERSION) return normalizeApprovedIndex(store, index)
    return upsertSeedPool(store, index)
  }
  return seedApprovedPool(store)
}

// --- Recommendation engine (PRD §7 Phase 1) --------------------------------

function frequencyMap(values) {
  const map = new Map()
  for (const value of values.filter(Boolean)) map.set(value, (map.get(value) || 0) + 1)
  return map
}

export function scoreSummary(summary, now, context = {}) {
  const net = (summary.upVotes || 0) - (summary.downVotes || 0)
  const votePart = Math.tanh(net / 5) // -1..1, saturates so a few votes don't dominate
  const ageDays = Math.max(0, (now - new Date(summary.createdAt).getTime()) / 86_400_000)
  const freshness = 1 / (1 + ageDays / 30) // ~1 for new, decays over months
  const random = Math.random() // serendipity — the StumbleUpon magic
  const recentDomains = context.recentDomains || new Set()
  const recentContentTypes = context.recentContentTypes || new Map()
  const domainPenalty = recentDomains.has(summary.domain) ? -0.45 : 0
  const typePenalty = Math.min(0.3, (recentContentTypes.get(summary.contentType) || 0) * 0.08)
  // Pages liked by people you follow get a nudge so a trusted curator's taste
  // surfaces more often, without overpowering serendipity.
  const socialBonus = context.socialIds && context.socialIds.has(summary.id) ? 0.4 : 0

  // Serendipity stays the largest signal; votes, freshness, and quality nudge
  // the pool, while recent-domain/type penalties keep one site from clumping.
  return (
    0.35 * qualityScore(summary.qualityScore) +
    0.25 * votePart +
    0.15 * freshness +
    0.8 * random +
    socialBonus +
    domainPenalty -
    typePenalty
  )
}

// Score the pool, keep the top N, then pick randomly within it so picks never
// feel deterministic (PRD §7 Phase 1).
export function buildRecommendationContext(recentSummaries = []) {
  const recent = Array.isArray(recentSummaries) ? recentSummaries : []
  return {
    recentDomains: new Set(recent.slice(-8).map((summary) => summary.domain).filter(Boolean)),
    recentContentTypes: frequencyMap(recent.slice(-12).map((summary) => summary.contentType)),
  }
}

// Score a broad candidate shelf, then perform a weighted random pick. This is
// less deterministic than "top result wins" but still avoids stale clusters.
export function pickFromPool(pool, now, options = {}) {
  if (!pool.length) return null
  const topN = options.topN || 40
  const context = buildRecommendationContext(options.recentSummaries || [])
  // Optional set of pageIds liked by people the user follows (social blend).
  context.socialIds = options.socialIds || null
  const scored = pool
    .map((summary) => ({ summary, score: scoreSummary(summary, now, context) }))
    .sort((a, b) => b.score - a.score)
  const top = scored.slice(0, Math.min(topN, scored.length))
  const floor = Math.min(...top.map((item) => item.score))
  const weighted = top.map((item) => ({
    ...item,
    weight: Math.max(0.05, item.score - floor + 0.05),
  }))
  const total = weighted.reduce((sum, item) => sum + item.weight, 0)
  let cursor = Math.random() * total
  for (const item of weighted) {
    cursor -= item.weight
    if (cursor <= 0) return item.summary
  }
  return weighted[weighted.length - 1].summary
}

// Append an id to the seen list, de-duped and capped to a rolling window.
export function appendSeen(seen, id) {
  const next = (Array.isArray(seen) ? seen : []).filter((x) => x !== id)
  next.push(id)
  if (next.length > SEEN_CAP) next.splice(0, next.length - SEEN_CAP)
  return next
}
