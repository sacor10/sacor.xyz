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
// Correctness note: /channel/ID/live only serves the channel's own live watch
// page while it's actually live. When it isn't, YouTube redirects to a page
// full of *other* content (channel home, recommended live shelves). So we never
// trust a loose regex sweep of the HTML — that's how an earlier version ended up
// embedding random unrelated livestreams. Instead we parse the single
// ytInitialPlayerResponse (the video the page is really about) and only accept
// it when its channelId matches the channel we asked for AND it's live.
//
// Returns { live: true, videoId } when the channel is live now, otherwise
// { live: false }. Never throws toward the client: an unreachable/unparseable
// upstream returns { live: false, error } so the frontend shows its offline
// card instead of the embed's error screen. Add ?debug=1 for the raw signals.

const PROBE_TIMEOUT_MS = 8000

// A real desktop browser UA — YouTube serves a very different (JS-less) page to
// unknown clients, and the player response we parse only appears for one that
// looks like a browser.
const PROBE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Consent cookies so YouTube serves the real watch page instead of the EU
// "before you continue" interstitial (which carries no player JSON we parse).
const CONSENT_COOKIE = 'SOCS=CAI; CONSENT=YES+1'

const CHANNEL_RE = /^UC[\w-]{22}$/

// Pull one balanced JSON object out of the page, starting at the first '{' after
// `marker`. YouTube inlines ytInitialPlayerResponse as a raw JS object literal,
// so a brace counter (string-aware, so braces inside strings don't count) gives
// us the exact object without depending on any trailing delimiter.
function extractJsonObject(html, marker) {
  const from = html.indexOf(marker)
  if (from === -1) return null
  const start = html.indexOf('{', from)
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
    } else if (ch === '"') {
      inString = true
    } else if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

// Inspect the parsed player response and decide whether it describes *this*
// channel's broadcast, live right now. The channelId match is the load-bearing
// guard: even if YouTube hands back some other video, a mismatch means offline
// rather than embedding a stranger's stream.
function evaluate(playerResponse, channel) {
  const vd = playerResponse?.videoDetails
  const micro = playerResponse?.microformat?.playerMicroformatRenderer
  const status = playerResponse?.playabilityStatus?.status ?? null
  const channelInPage = vd?.channelId ?? null
  const belongsToChannel = channelInPage === channel
  const isLiveNow = micro?.liveBroadcastDetails?.isLiveNow === true
  const isLive = vd?.isLive === true
  const live = belongsToChannel && status === 'OK' && (isLiveNow || isLive)

  return {
    live,
    videoId: live ? vd.videoId : null,
    status,
    channelInPage,
    belongsToChannel,
    isLiveNow,
    isLive,
  }
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
  // YouTube from every page view, short enough that "we just went live" shows up
  // within a minute. Debug requests skip the cache for fresh signals.
  const cache = { 'Cache-Control': debug ? 'no-store' : 'public, max-age=60' }

  let res
  try {
    res = await fetch(`https://www.youtube.com/channel/${channel}/live`, {
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
  const playerResponse = extractJsonObject(html, 'ytInitialPlayerResponse')
  const verdict = evaluate(playerResponse, channel)

  if (debug) {
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null
    return json(
      {
        live: verdict.live,
        videoId: verdict.videoId,
        requestedChannel: channel,
        channelInPage: verdict.channelInPage,
        belongsToChannel: verdict.belongsToChannel,
        playabilityStatus: verdict.status,
        isLiveNow: verdict.isLiveNow,
        isLive: verdict.isLive,
        hasPlayerResponse: Boolean(playerResponse),
        upstreamStatus: res.status,
        finalUrl: res.url,
        title,
      },
      { headers: cache },
    )
  }

  if (verdict.live) {
    return json({ live: true, videoId: verdict.videoId }, { headers: cache })
  }

  return json({ live: false }, { headers: cache })
}
