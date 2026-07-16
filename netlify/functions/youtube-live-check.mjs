import { json } from './_lib/stumble.mjs'

// GET /youtube-live-check?channel=UC...
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
// card instead of the embed's error screen.

const PROBE_TIMEOUT_MS = 6000

// A real desktop browser UA — YouTube serves a very different (JS-less) page to
// unknown clients, and the live player response we parse only appears for one
// that looks like a browser.
const PROBE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

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

  return null
}

export default async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })

  const channel = new URL(req.url).searchParams.get('channel')
  if (!channel || !CHANNEL_RE.test(channel)) {
    return json({ live: false, error: 'invalid channel' }, { status: 400 })
  }

  // Live status flips over time, so cache only briefly — long enough to shield
  // YouTube from every page view, short enough that "we just went live" shows
  // up within a minute.
  const cache = { 'Cache-Control': 'public, max-age=60' }

  let res
  try {
    res = await fetch(`https://www.youtube.com/channel/${channel}/live`, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: {
        'User-Agent': PROBE_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        // Skip the EU consent interstitial so we get the real page.
        Cookie: 'CONSENT=YES+1',
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

  // `isLiveNow` inside liveBroadcastDetails is YouTube's own "streaming at this
  // moment" flag — it's false for upcoming/scheduled and past broadcasts, so it
  // cleanly separates "live now" from "there's a stream, just not on air."
  const liveNow = /"isLiveNow":\s*true/.test(html)
  const videoId = extractVideoId(html)

  if (liveNow && videoId) {
    return json({ live: true, videoId }, { headers: cache })
  }

  return json({ live: false }, { headers: cache })
}
