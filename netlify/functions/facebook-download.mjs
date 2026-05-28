/**
 * Resolves the video URL for a public Facebook video, reel, or watch link.
 *
 * Facebook has no public JSON API, so we resolve any short/share link to its
 * canonical URL, fetch the page HTML with a few User-Agents, and extract the
 * progressive MP4 from the inlined JSON state. We try, in order:
 *
 *   1. Resolve share links (/share/r/<id>, /share/v/<id>) and fb.watch/<id>
 *      to their canonical URL by following redirects server-side.
 *   2. Fetch the canonical page with a desktop Chrome UA, then retry with an
 *      mbasic UA and a preview-bot UA if the first pass yields nothing.
 *   3. Pull MP4 URLs from the HTML three ways:
 *      a. The HD/SD JSON keys Facebook inlines
 *         (playable_url_quality_hd, playable_url, browser_native_hd_url,
 *          browser_native_sd_url, hd_src, sd_src).
 *      b. og:video / og:video:url / og:video:secure_url meta tags.
 *      c. A flat regex over the raw HTML for *.fbcdn.net ...mp4 URLs.
 *
 * Returns JSON metadata; the browser fetches the actual MP4 via the fbcdn
 * proxy function to keep bytes out of the Lambda response.
 *
 * Append ?debug=1 to receive the per-attempt diagnostic trace alongside a
 * successful response too. Failures always include the trace.
 */
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
// mbasic serves a lighter, login-optional HTML shell that still carries the
// public video source for many posts.
const MBASIC_UA =
  'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'
// Slackbot reliably receives the OG-tag share preview without the app shell.
const PREVIEW_UA = 'Slackbot 1.0 (+https://api.slack.com/robots)'
const FETCH_TIMEOUT_MS = 8000
const MAX_REDIRECTS = 5

const VALID_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'web.facebook.com',
  'mbasic.facebook.com',
  'fb.watch',
  'www.fb.watch',
])

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

const errorBody = (code, message, status) => json({ code, message }, status)

function isFacebookHost(hostname) {
  const host = hostname.toLowerCase()
  return VALID_HOSTS.has(host) || host.endsWith('.facebook.com') || host === 'fb.watch'
}

// Share links and fb.watch short links don't expose the video directly — they
// 30x-redirect to a canonical /reel/<id> or /watch?v=<id> URL.
function isShortLink(parsed) {
  const path = parsed.pathname
  return (
    parsed.hostname.toLowerCase().endsWith('fb.watch') ||
    /^\/share\/(r|v)\//.test(path)
  )
}

function sanitizeFilenamePart(value, fallback) {
  const cleaned = String(value || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '')
    .slice(0, 60)
  return cleaned || fallback
}

// Pull a stable video id from any canonical Facebook URL shape.
function extractVideoId(parsed) {
  const path = parsed.pathname
  const reel = path.match(/\/reel\/(\d+)/)
  if (reel) return reel[1]
  const videos = path.match(/\/videos\/(?:[^/]+\/)?(\d+)/)
  if (videos) return videos[1]
  const v = parsed.searchParams.get('v')
  if (v && /^\d+$/.test(v)) return v
  const watch = path.match(/\/watch\/?$/)
  if (watch && v) return v
  return null
}

async function resolveShortLink(url) {
  let current = url
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': DESKTOP_UA },
    })
    const location = res.headers.get('location')
    if (!location) return current
    current = new URL(location, current).toString()
    try {
      if (extractVideoId(new URL(current))) return current
    } catch { /* keep following */ }
  }
  return current
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
}

// Facebook inlines URLs as JSON string literals: forward slashes are escaped
// as \/ and ampersands as &. Normalising both lets the flat regex and the
// JSON-key scan see clean URLs.
function decodeJsonString(value) {
  return value
    .replace(/\\\//g, '/')
    .replace(/\\u002F/gi, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003D/gi, '=')
    .replace(/\\u003F/gi, '?')
    .replace(/\\u0025/gi, '%')
}

function isFbVideoUrl(url) {
  return /\.fbcdn\.net\//i.test(url) && /\.mp4/i.test(url)
}

// Strategy a: the explicit HD/SD JSON keys Facebook ships in the page state.
// Listed best-quality-first so the HD source wins when several are present.
function extractFromJsonKeys(html) {
  const keys = [
    'playable_url_quality_hd',
    'browser_native_hd_url',
    'hd_src',
    'hd_src_no_ratelimit',
    'playable_url',
    'browser_native_sd_url',
    'sd_src',
    'sd_src_no_ratelimit',
  ]
  const out = []
  const seen = new Set()
  for (const key of keys) {
    const re = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'g')
    let m
    while ((m = re.exec(html)) !== null) {
      if (!m[1]) continue
      const url = decodeJsonString(m[1])
      if (!isFbVideoUrl(url) || seen.has(url)) continue
      seen.add(url)
      const hd = /hd/i.test(key)
      out.push({ url, width: null, height: null, bitrate: hd ? 2 : 1 })
    }
  }
  return out
}

// Strategy b: Open Graph video meta tags (present on share-preview HTML).
function extractOgVideo(html) {
  const tags = {}
  const metaRe = /<meta\b[^>]*>/gi
  let tag
  while ((tag = metaRe.exec(html)) !== null) {
    const m = tag[0]
    const propMatch = m.match(/\b(?:property|name)=["']([^"']+)["']/i)
    const contentMatch = m.match(/\bcontent=["']([^"']*)["']/i)
    if (!propMatch || !contentMatch) continue
    const prop = propMatch[1].toLowerCase()
    if (prop.startsWith('og:video')) tags[prop] = decodeHtmlEntities(contentMatch[1])
  }
  const url = tags['og:video:secure_url'] || tags['og:video:url'] || tags['og:video']
  if (!url || !/\.mp4/i.test(url)) return []
  return [{
    url,
    width: Number(tags['og:video:width']) || null,
    height: Number(tags['og:video:height']) || null,
    bitrate: 0,
  }]
}

// Strategy c: last-resort flat scan for any fbcdn .mp4 URL in the raw HTML.
function fallbackHtmlMp4Scan(html) {
  const re = /https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.fbcdn\.net\/[^\s"'<>)\\]*?\.mp4[^\s"'<>)\\]*/gi
  const seen = new Set()
  const out = []
  let m
  while ((m = re.exec(html)) !== null) {
    const url = m[0]
    if (seen.has(url)) continue
    seen.add(url)
    out.push({ url, width: null, height: null, bitrate: 0 })
  }
  return out
}

function findAllVideosInHtml(html) {
  const decoded = decodeJsonString(html)
  const keyed = extractFromJsonKeys(decoded)
  const og = extractOgVideo(decoded)
  const flat = fallbackHtmlMp4Scan(decoded)
  const seen = new Set()
  const merged = []
  for (const stream of [...keyed, ...og, ...flat]) {
    if (seen.has(stream.url)) continue
    seen.add(stream.url)
    merged.push(stream)
  }
  return { keyed, og, flat, merged }
}

async function fetchHtml(url, userAgent, label) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    })
    const html = await res.text()
    return { label, url, ua: userAgent, status: res.status, ok: res.ok, htmlLength: html.length, html }
  } catch (err) {
    return { label, url, ua: userAgent, status: 0, ok: false, error: String(err?.message || err) }
  } finally {
    clearTimeout(timer)
  }
}

// Prefer the highest-quality source; bitrate is our HD/SD rank, 2 = HD.
function pickBestStream(streams) {
  if (streams.length === 0) return null
  const sorted = [...streams].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
  return sorted[0]
}

function buildAttempts(canonicalUrl) {
  const parsed = new URL(canonicalUrl)
  const mbasicUrl = `https://mbasic.facebook.com${parsed.pathname}${parsed.search}`
  return [
    { url: canonicalUrl, ua: DESKTOP_UA, label: 'canonical+desktop' },
    { url: mbasicUrl, ua: MBASIC_UA, label: 'mbasic+mobile' },
    { url: canonicalUrl, ua: PREVIEW_UA, label: 'canonical+slackbot' },
  ]
}

export default async (req) => {
  const incoming = new URL(req.url)
  const debugMode = incoming.searchParams.get('debug') === '1'

  if (req.method !== 'POST') {
    return errorBody('method_not_allowed', 'Use POST.', 405)
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return errorBody('invalid_json', 'Request body must be valid JSON.', 400)
  }

  const input = payload?.url
  if (typeof input !== 'string' || !input.trim()) {
    return errorBody('invalid_url', 'Enter a public Facebook video URL.', 400)
  }

  let parsed
  try {
    parsed = new URL(input.trim())
  } catch {
    return errorBody('invalid_url', 'Enter a public Facebook video URL.', 400)
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !isFacebookHost(parsed.hostname)) {
    return errorBody('invalid_url', 'Only facebook.com and fb.watch URLs are supported.', 400)
  }

  // Resolve share / fb.watch short links to the canonical video URL.
  let canonicalUrl = input.trim()
  if (isShortLink(parsed)) {
    try {
      canonicalUrl = await resolveShortLink(canonicalUrl)
    } catch {
      return errorBody('extract_failed', 'Could not resolve the share link.', 502)
    }
  }

  let canonicalParsed
  try {
    canonicalParsed = new URL(canonicalUrl)
  } catch {
    return errorBody('extract_failed', 'Could not resolve the share link.', 502)
  }

  const videoId = extractVideoId(canonicalParsed)

  const attempts = buildAttempts(canonicalUrl)
  const trace = []
  let winningStreams = []

  for (const attempt of attempts) {
    const fetched = await fetchHtml(attempt.url, attempt.ua, attempt.label)
    const traceEntry = {
      label: fetched.label,
      url: fetched.url,
      status: fetched.status,
      ok: fetched.ok,
      htmlLength: fetched.htmlLength || 0,
      error: fetched.error || null,
      keyedCount: 0,
      ogCount: 0,
      flatCount: 0,
      sample: null,
    }
    if (fetched.ok && fetched.html) {
      const { keyed, og, flat, merged } = findAllVideosInHtml(fetched.html)
      traceEntry.keyedCount = keyed.length
      traceEntry.ogCount = og.length
      traceEntry.flatCount = flat.length
      traceEntry.sample = fetched.html.slice(0, debugMode ? 8000 : 2000)
      if (merged.length > 0) {
        winningStreams = merged
        trace.push(traceEntry)
        break
      }
    }
    trace.push(traceEntry)
  }

  if (winningStreams.length === 0) {
    console.error('[facebook-download] no videos found', JSON.stringify({
      input,
      canonicalUrl,
      videoId,
      trace: trace.map(({ sample, ...rest }) => rest),
    }))
    const anyFetchOk = trace.some((t) => t.ok)
    const code = anyFetchOk ? 'no_videos' : 'extract_failed'
    const message = anyFetchOk
      ? 'No public Facebook video was found for that URL. Private, login-gated, or image-only posts are out of scope.'
      : 'Could not read public Facebook media for that URL.'
    const status = anyFetchOk ? 404 : 502
    return json({ code, message, trace }, status)
  }

  const best = pickBestStream(winningStreams)
  const baseName = sanitizeFilenamePart(videoId ? `facebook-${videoId}` : '', 'facebook-video')
  const filename = `${baseName}.mp4`

  const video = {
    url: best.url,
    proxyUrl: `/.netlify/functions/facebook-video?url=${encodeURIComponent(best.url)}&filename=${encodeURIComponent(filename)}`,
    filename,
    width: best.width,
    height: best.height,
  }

  if (debugMode) {
    return json({ videos: [video], trace })
  }
  return json({ videos: [video] })
}
