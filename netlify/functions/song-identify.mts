import { getStore, type Store } from '@netlify/blobs'
import { createHash } from 'node:crypto'
import { MAX_CLIP_BYTES } from '../../src/lib/songid/constants'
import { parseWav } from '../../src/lib/songid/wav'
import { readSessionCookie, userHash } from './_lib/session.mjs'
import { createAuddProvider } from './_lib/songid/audd'
import { ProviderError } from './_lib/songid/normalize'
import { runSpeedSweep } from './_lib/songid/sweep'
import type { IdentifyOutcome } from './_lib/songid/types'

/**
 * Song identification proxy. The browser sends a 12s mono PCM WAV clip; this
 * function validates it, applies rate/cost limits, runs the speed sweep
 * against the recognition provider, and returns the normalized outcome.
 *
 * Abuse controls (each on its own because a paid API sits behind this):
 *   - kill switch env var (SONG_ID_DISABLED)
 *   - requires a signed-in Google session (blocks anonymous scripting)
 *   - per-user hourly rate limit in Netlify Blobs (shared across invocations)
 *   - global monthly provider-call cap in Blobs = the cost ceiling
 *   - result cache keyed by clip hash, so retries cost zero provider calls
 * Privacy: audio lives in function memory only — never persisted, never
 * logged; logs carry counts and outcomes, not content or filenames.
 */

const MAX_CLIP_SECONDS = 12.5
const STORE_NAME = 'songid'

const readIntEnv = (name: string, fallback: number): number => {
  const value = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

const errorJson = (code: string, message: string, status: number): Response =>
  json({ code, message }, status)

// --- Blobs counters (same pattern as geocode.mjs) -------------------------

const loadJson = async (store: Store, key: string, fallback: unknown): Promise<unknown> => {
  const raw = await store.get(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

/** Increment a Blobs counter; returns false once the limit is reached. */
async function bumpCounter(store: Store, key: string, limit: number): Promise<boolean> {
  const current = (await loadJson(store, key, { count: 0 })) as { count?: number }
  const count = Number(current?.count || 0)
  if (count >= limit) return false
  await store.set(key, JSON.stringify({ count: count + 1, updatedAt: new Date().toISOString() }))
  return true
}

const hourKey = () => new Date().toISOString().slice(0, 13)
const monthKey = () => new Date().toISOString().slice(0, 7)

export default async (req: Request) => {
  if (process.env.SONG_ID_DISABLED === 'true') {
    return errorJson('disabled', 'Song identification is temporarily switched off.', 503)
  }
  if (req.method !== 'POST') {
    return errorJson('method_not_allowed', 'POST an audio/wav clip.', 405)
  }
  const token = String(process.env.AUDD_API_TOKEN || '').trim()
  if (!token) {
    return errorJson('not_configured', 'Song identification is not configured.', 503)
  }

  // Sign-in gate: only authenticated Google accounts may spend lookups.
  let session: { email: string } | null
  try {
    session = readSessionCookie(req)
  } catch {
    // Missing/short SESSION_SECRET makes auth unverifiable — treat as misconfig.
    return errorJson('not_configured', 'Song identification is not configured.', 503)
  }
  if (!session) {
    return errorJson('auth_required', 'Sign in with Google to identify songs.', 401)
  }

  const clip = new Uint8Array(await req.arrayBuffer())
  if (clip.byteLength > MAX_CLIP_BYTES) {
    return errorJson('clip_too_large', 'Analysis clip exceeds the size limit.', 413)
  }
  const info = parseWav(clip)
  if (!info || info.channels !== 1) {
    return errorJson('unsupported_media', 'Expected a mono 16-bit PCM WAV clip.', 415)
  }
  if (info.durationSeconds > MAX_CLIP_SECONDS) {
    return errorJson('clip_too_long', 'Analysis clip must be at most 12 seconds.', 413)
  }

  const store = getStore(STORE_NAME)

  // Per-user hourly limit (caps a runaway or shared account). Fail closed:
  // this endpoint spends real money, so a Blobs outage pauses it, not uncaps it.
  const hourlyLimit = readIntEnv('SONG_ID_RATE_LIMIT_PER_HOUR', 10)
  let allowed = false
  try {
    allowed = await bumpCounter(store, `rate/hour/${hourKey()}/user-${userHash(session.email)}`, hourlyLimit)
  } catch (err) {
    console.warn('songid rate-limit check failed', err)
    return errorJson('unavailable', 'Song identification is briefly unavailable. Try again in a minute.', 503)
  }
  if (!allowed) {
    return errorJson(
      'rate_limited',
      `Limit is ${hourlyLimit} lookups per hour — try again within the hour.`,
      429,
    )
  }

  // Cache: a repeat of the same clip returns the stored outcome for free.
  const clipHash = createHash('sha256').update(clip).digest('hex')
  const cacheKey = `cache/${clipHash}`
  try {
    const cached = (await loadJson(store, cacheKey, null)) as { outcome?: IdentifyOutcome } | null
    if (cached?.outcome) {
      console.log('songid outcome=cache_hit')
      return json({ ...cached.outcome, cached: true })
    }
  } catch (err) {
    console.warn('songid cache read failed', err)
  }

  const monthlyCap = readIntEnv('SONG_ID_MONTHLY_CALL_CAP', 1000)
  const maxAttempts = readIntEnv('SONG_ID_MAX_SWEEP_ATTEMPTS', 4)
  const provider = createAuddProvider({ token })

  let sweep
  try {
    sweep = await runSpeedSweep(clip, info, maxAttempts, {
      provider,
      reserveCall: () => bumpCounter(store, `usage/month/${monthKey()}`, monthlyCap),
    })
  } catch (err) {
    if (err instanceof ProviderError) {
      console.warn('songid outcome=provider_error', err.message)
      return errorJson('provider_error', 'The recognition service had a problem. Try again later.', 502)
    }
    console.warn('songid outcome=error', err instanceof Error ? err.message : err)
    return errorJson('internal_error', 'Something went wrong identifying this clip.', 500)
  }

  const { outcome, capExhausted } = sweep
  if (capExhausted && outcome.attemptsUsed === 0) {
    console.log('songid outcome=monthly_cap')
    return errorJson('quota_exhausted', 'The monthly identification budget is used up. Back next month.', 503)
  }

  console.log(
    `songid outcome=${outcome.status} attempts=${outcome.attemptsUsed}` +
      (outcome.status === 'match' ? ` factor=${outcome.matchedFactor}` : '') +
      (capExhausted ? ' cap_exhausted=1' : ''),
  )

  try {
    await store.set(cacheKey, JSON.stringify({ outcome, cachedAt: new Date().toISOString() }))
  } catch (err) {
    console.warn('songid cache write failed', err)
  }

  return json(outcome)
}
