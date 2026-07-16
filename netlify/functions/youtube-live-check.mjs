import { json } from './_lib/stumble.mjs'

// GET /youtube-live-check?channel=UC...   (&debug=1 for diagnostics)
//
// Resolve whether a YouTube channel is streaming *right now*, and if so the
// exact video id of the current live broadcast.
//
// Why this exists: the old players embedded
// https://www.youtube.com/embed/live_stream?channel=CHANNEL_ID, which resolves
// the channel's current live video server-side at YouTube. When the channel is
// offline (which for a "live 09:00 PT weekdays" stream is most of the day) that
// endpoint doesn't degrade — it renders YouTube's raw "An error occurred.
// Please try again later. (Playback ID: …)" screen right inside the iframe. The
// browser can't read that failure because the frame is cross-origin, so the
// only way to show something friendlier is to ask the server first — exactly
// like stumble-frame-check does for arbitrary sites.
//
// Returns { live: true, videoId } when the channel is live now, otherwise
// { live: false }. Never throws toward the client: an unreachable/unparseable
// upstream returns { live: false, error } so the frontend shows its offline
// card instead of the embed's error screen. Add ?debug=1 to get the raw signals
// (upstream status, which markers matched, page title) for troubleshooting.

const PROBE_TIMEOUT_MS = 8000

// A real desktop browser UA — YouTube serves a very different (JS-less) page to
// unknown clients, and the live player response we parse only appears for one
// that looks like a browser.
const PROBE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Consent cookies so YouTube serves the real watch page instead of the EU
// "before you continue" interstitial (which carries none of the player JSON we
// parse). SOCS is the current cookie; CONSENT is the older one — send both.
const CONSENT_COOKIE = 'SOCS=CAI; CONSENT=YES+1'

const CHANNEL_RE = /^UC[\w-]{22}$/

// Pull the first 11-char video id out of the live watch page. Prefer the
// canonical link (only present on a real watch page) and fall back to the
// videoDetails blob in ytInitialPlayerResponse.
function extractVideoId(html) {
  const canonical = html.match(
    /<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/i,
  )
  if (canonical) return canonical[1]

  const details = html.match(/"videoDetails":\{"videoId":"([\w-]{11})"/)
  if (details) return details[1]

  const embedded = html.match(/\\?"videoId\\?":\\?"([\w-]{11})\\?"/)
  if (embedded) return embedded[1]

  return null
}

// Decide whether the page describes a broadcast that's on the air *right now*.
// YouTube ships a few different markers depending on the page variant and A/B
// bucket, so check several rather than betting on one:
//   isLiveNow        — liveBroadcastDetails flag, the cleanest signal
//   isLive           — videoDetails flag on a currently-live watch page
//   hlsManifestUrl   — only present while a stream is actually broadcasting
//   LIVE_NOW badge   — the red "LIVE" pill shown on live content
// Any one of them (with a resolvable video id) means live. An *upcoming* stream
// has none of these true, so scheduled-but-not-started still reads as offline.
function detectLive(html) {
  const signals = {
    isLiveNow: /"isLiveNow":\s*true/.test(html),
    isLive: /"isLive":\s*true/.test(html),
    hlsManifestUrl: /"hlsManifestUrl":\s*"/.test(html),
    // Weaker/diagnostic only: the red LIVE pill can appear in a shelf on a
    // channel-home page for some *other* live video, so it doesn't decide.
    liveBadge: /BADGE_STYLE_TYPE_LIVE_NOW/.test(html),
  }
  const live = signals.isLiveNow || signals.isLive || signals.hlsManifestUrl
  return { live, signals }
}

export default async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })

  const reqUrl = new URL(req.url)
  const channel = reqUrl.searchParams.get('channel')
  const debug = reqUrl.searchParams.get('debug') === '1'
  if (!channel || !CHANNEL_RE.test(channel)) {
    return json({ live: false, error: 'invalid channel' }, { status: 400 })
  }

  // Live status flips over time, so cache only briefly — long enough to shield
  // YouTube from every page view, short enough that "we just went live" shows
  // up within a minute. Debug requests skip the cache so we always see fresh
  // signals while troubleshooting.
  const cache = { 'Cache-Control': debug ? 'no-store' : 'public, max-age=60' }

  const target = `https://www.youtube.com/channel/${channel}/live`

  let res
  try {
    res = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: {
        'User-Agent': PROBE_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: CONSENT_COOKIE,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
  } catch (err) {
    const error = err?.name === 'TimeoutError' ? 'timeout' : 'unreachable'
    return json({ live: false, error }, { headers: cache })
  }

  if (!res.ok) {
    return json({ live: false, error: `http-${res.status}` }, { headers: cache })
  }

  const html = await res.text()
  const { live, signals } = detectLive(html)
  const videoId = extractVideoId(html)

  if (debug) {
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null
    return json(
      {
        live: Boolean(live && videoId),
        videoId,
        signals,
        upstreamStatus: res.status,
        finalUrl: res.url,
        htmlLength: html.length,
        hasPlayerResponse: html.includes('ytInitialPlayerResponse'),
        looksLikeConsent: /consent\.(youtube|google)\.com/.test(res.url) ||
          html.includes('Before you continue'),
        title,
      },
      { headers: cache },
    )
  }

  if (live && videoId) {
    return json({ live: true, videoId }, { headers: cache })
  }

  return json({ live: false }, { headers: cache })
}
