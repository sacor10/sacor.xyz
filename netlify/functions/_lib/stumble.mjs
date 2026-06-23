import { getStore } from '@netlify/blobs'
import { createHash } from 'node:crypto'
import { stumbleSeedPages } from '../../../src/data/stumblePages.js'
import { isKnownInterest } from '../../../src/data/stumbleInterests.js'

// Shared helpers for the /stumble Netlify Functions. Mirrors the Blobs + index
// conventions used by travel-plans.mjs.

export const PAGES_STORE = 'stumble-pages'
export const USERS_STORE = 'stumble-users'

export const getPagesStore = () => getStore(PAGES_STORE)
export const getUsersStore = () => getStore(USERS_STORE)

export const APPROVED_INDEX_KEY = 'index/approved'
export const pageKey = (id) => `pages/${id}`
export const userInterestsKey = (hash) => `users/${hash}/interests`
export const userSeenKey = (hash) => `users/${hash}/seen`
export const userRatingsKey = (hash) => `users/${hash}/ratings`
export const userLikesKey = (hash) => `users/${hash}/likes`

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

// --- URL hygiene (PRD §9: validate, canonicalize, dedup) -------------------

const TRACKING_PARAM = /^(utm_.*|fbclid|gclid|dclid|mc_eid|mc_cid|ref|ref_src|igshid|si)$/i

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
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) u.searchParams.delete(key)
  }
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '')
  return u.toString()
}

export const pageIdForUrl = (canonicalUrl) =>
  createHash('sha256').update(canonicalUrl).digest('hex').slice(0, 16)

// --- Index summaries -------------------------------------------------------

export const summaryOf = (page) => ({
  id: page.id,
  interests: page.interests || [],
  upVotes: page.upVotes || 0,
  downVotes: page.downVotes || 0,
  createdAt: page.createdAt,
})

// Browser-facing shape of a page (omits moderation/internal fields).
export const clientPage = (page) => ({
  id: page.id,
  url: page.url,
  title: page.title,
  description: page.description || '',
  thumbnailUrl: page.thumbnailUrl || null,
  interests: page.interests || [],
  upVotes: page.upVotes || 0,
  downVotes: page.downVotes || 0,
})

// --- Seeding (lazy, like seedIfEmpty in travel-plans.mjs) ------------------

async function seedApprovedPool(store) {
  const now = new Date().toISOString()
  const index = []
  for (const seed of stumbleSeedPages) {
    const canonicalUrl = canonicalizeUrl(seed.url)
    if (!canonicalUrl) continue
    const id = pageIdForUrl(canonicalUrl)
    const page = {
      id,
      url: seed.url,
      canonicalUrl,
      title: seed.title,
      description: seed.description || '',
      thumbnailUrl: seed.thumbnailUrl || null,
      interests: (seed.interests || []).filter(isKnownInterest),
      status: 'approved',
      upVotes: 0,
      downVotes: 0,
      submittedBy: 'seed',
      createdAt: now,
    }
    await store.set(pageKey(id), JSON.stringify(page))
    index.push(summaryOf(page))
  }
  await saveJson(store, APPROVED_INDEX_KEY, index)
  return index
}

export async function loadApprovedIndex(store) {
  const index = await loadJson(store, APPROVED_INDEX_KEY, null)
  if (Array.isArray(index) && index.length > 0) return index
  return seedApprovedPool(store)
}

// --- Recommendation engine (PRD §7 Phase 1) --------------------------------

export function scoreSummary(summary, now) {
  const net = (summary.upVotes || 0) - (summary.downVotes || 0)
  const votePart = Math.tanh(net / 5) // -1..1, saturates so a few votes don't dominate
  const ageDays = Math.max(0, (now - new Date(summary.createdAt).getTime()) / 86_400_000)
  const freshness = 1 / (1 + ageDays / 30) // ~1 for new, decays over months
  const random = Math.random() // serendipity — the StumbleUpon magic
  return 0.5 * votePart + 0.2 * freshness + 0.8 * random
}

// Score the pool, keep the top N, then pick randomly within it so picks never
// feel deterministic (PRD §7 Phase 1).
export function pickFromPool(pool, now, topN = 10) {
  if (!pool.length) return null
  const scored = pool
    .map((summary) => ({ summary, score: scoreSummary(summary, now) }))
    .sort((a, b) => b.score - a.score)
  const top = scored.slice(0, Math.min(topN, scored.length))
  return top[Math.floor(Math.random() * top.length)].summary
}

// Append an id to the seen list, de-duped and capped to a rolling window.
export function appendSeen(seen, id) {
  const next = (Array.isArray(seen) ? seen : []).filter((x) => x !== id)
  next.push(id)
  if (next.length > SEEN_CAP) next.splice(0, next.length - SEEN_CAP)
  return next
}
