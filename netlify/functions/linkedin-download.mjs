/**
 * Resolves video URLs for a public LinkedIn post.
 *
 * LinkedIn does not expose a public JSON API, so we try several strategies in
 * sequence and stop at the first one that yields an MP4:
 *
 *   1. Fetch the canonical /posts/<slug> URL (if the user gave us one) with a
 *      social-preview User-Agent. LinkedIn emits Open Graph video meta tags
 *      for Slackbot/Twitterbot to enable link previews, and these point at
 *      the public MP4 on dms.licdn.com.
 *   2. Fetch the embed endpoint (/embed/feed/update/urn:li:<urnType>:<id>)
 *      with a desktop Chrome UA; try ugcPost and activity URN types.
 *   3. For each fetched HTML response, look for video stream URLs three ways:
 *      a. og:video / og:video:secure_url meta tags
 *      b. JSON blobs in <code>/<script> tags with progressiveStreams
 *      c. Flat regex over the raw HTML for *.licdn.com/...mp4 URLs
 *
 * Returns JSON metadata; the browser fetches the actual MP4 via the licdn
 * proxy function to keep bytes out of the Lambda response.
 *
 * Append ?debug=1 to receive the per-attempt diagnostic trace alongside a
 * successful response too. Failures always include the trace.
 */
const LINKEDIN_HOST = 'https://www.linkedin.com'
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
// Slackbot is the most permissive preview-bot UA for LinkedIn — it reliably
// receives the OG-tag share preview HTML without the full app shell.
const PREVIEW_UA = 'Slackbot 1.0 (+https://api.slack.com/robots)'
const FETCH_TIMEOUT_MS = 8000

const SLUG_RE = /-(ugcPost|activity)-(\d{19})(?:-[A-Za-z0-9_-]{1,8})?$/
const URN_RE = /\/feed\/update\/urn:li:(ugcPost|activity):(\d{19})/i

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

const errorBody = (code, message, status) => json({ code, message }, status)

function isLinkedInHost(hostname) {
  const host = hostname.toLowerCase()
  return host === 'linkedin.com' || host.endsWith('.linkedin.com')
}

function validateLinkedInUrl(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return { error: errorBody('invalid_url', 'Enter a public LinkedIn post URL.', 400) }
  }
  let parsed
  try {
    parsed = new URL(input)
  } catch {
    return { error: errorBody('invalid_url', 'Enter a public LinkedIn post URL.', 400) }
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !isLinkedInHost(parsed.hostname)) {
    return { error: errorBody('invalid_url', 'Only linkedin.com URLs are supported.', 400) }
  }
  const urnMatch = parsed.pathname.match(URN_RE)
  if (urnMatch) {
    return {
      urnType: urnMatch[1], id: urnMatch[2], slug: null, author: null, canonicalUrl: null,
    }
  }
  const slugMatch = parsed.pathname.match(SLUG_RE)
  if (slugMatch) {
    const postsMatch = parsed.pathname.match(/\/posts\/([^/_]+)_(.+)$/)
    const author = postsMatch ? postsMatch[1] : null
    const slugRaw = postsMatch
      ? postsMatch[2].replace(SLUG_RE, '')
      : null
    return {
      urnType: slugMatch[1], id: slugMatch[2], slug: slugRaw, author,
      // Preserve the original /posts/... URL — OG tags only exist on the canonical page
      canonicalUrl: `https://www.linkedin.com${parsed.pathname}`,
    }
  }
  return { error: errorBody('invalid_url', 'Use a LinkedIn /posts/... or /feed/update/urn:li:... URL.', 400) }
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

function extractOgVideo(html) {
  // LinkedIn emits og:video / og:video:url / og:video:secure_url with the
  // canonical MP4. Width/height come from og:video:width and og:video:height.
  const tags = {}
  const metaRe = /<meta\b[^>]*>/gi
  let tag
  while ((tag = metaRe.exec(html)) !== null) {
    const m = tag[0]
    const propMatch = m.match(/\b(?:property|name)=["']([^"']+)["']/i)
    const contentMatch = m.match(/\bcontent=["']([^"']*)["']/i)
    if (!propMatch || !contentMatch) continue
    const prop = propMatch[1].toLowerCase()
    if (prop.startsWith('og:video') || prop === 'og:image') {
      tags[prop] = decodeHtmlEntities(contentMatch[1])
    }
  }
  const url = tags['og:video:secure_url'] || tags['og:video:url'] || tags['og:video']
  if (!url || !/mp4/i.test(url)) return []
  return [{
    url,
    width: Number(tags['og:video:width']) || null,
    height: Number(tags['og:video:height']) || null,
    bitrate: 0,
  }]
}

function extractEmbeddedJsonBlobs(html) {
  const blobs = []
  const patterns = [
    /<code[^>]*>([\s\S]*?)<\/code>/g,
    // Match any script tag whose type contains "json" — catches the standard
    // application/json, application/ld+json, and LinkedIn's SSR-data type
    // application/vnd.linkedin.deferred-response+json.
    /<script[^>]*\btype=["'][^"']*json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(html)) !== null) {
      const raw = m[1].trim()
      if (!raw || (raw[0] !== '{' && raw[0] !== '[' && !raw.startsWith('&'))) continue
      const decoded = decodeHtmlEntities(raw)
      try {
        blobs.push(JSON.parse(decoded))
      } catch { /* skip non-JSON code blocks */ }
    }
  }
  return blobs
}

/**
 * LinkedIn's SSR HTML inlines JSON that emits URLs as `https:\/\/...` (each
 * forward slash backslash-escaped). Replacing the escaped form with the bare
 * form makes both our `https://...licdn.com...mp4` flat regex and a possible
 * downstream substring scan see the URLs. JSON itself accepts `/` unescaped,
 * so this transform doesn't break JSON parses elsewhere.
 */
function unescapeForwardSlashes(html) {
  return html.replace(/\\\//g, '/')
}

function findProgressiveStreamsByRegex(html) {
  // Last resort when even broadened blob extraction fails: scan the unescaped
  // HTML for occurrences of `"progressiveStreams":[...]` and try to parse the
  // enclosing object directly. Cheap and tolerant of unknown wrapper shapes.
  const out = []
  const seen = new Set()
  const marker = '"progressiveStreams"'
  let idx = 0
  while ((idx = html.indexOf(marker, idx)) !== -1) {
    const arrStart = html.indexOf('[', idx)
    if (arrStart === -1) break
    let depth = 0
    let end = -1
    for (let i = arrStart; i < html.length; i++) {
      const ch = html[i]
      if (ch === '[') depth++
      else if (ch === ']') {
        depth--
        if (depth === 0) { end = i; break }
      }
    }
    if (end === -1) break
    const slice = html.slice(arrStart, end + 1)
    try {
      const streams = JSON.parse(slice)
      collectMp4Streams({ progressiveStreams: streams }, out, seen)
    } catch { /* try next occurrence */ }
    idx = end + 1
  }
  return out
}

function collectMp4Streams(node, out, seen) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) collectMp4Streams(item, out, seen)
    return
  }
  if (Array.isArray(node.progressiveStreams)) {
    for (const stream of node.progressiveStreams) {
      if (!stream || typeof stream !== 'object') continue
      const locations = Array.isArray(stream.streamingLocations)
        ? stream.streamingLocations
        : []
      for (const loc of locations) {
        const url = typeof loc?.url === 'string' ? loc.url : null
        if (!url || !/mp4/i.test(url) || seen.has(url)) continue
        seen.add(url)
        out.push({
          url,
          width: Number(stream.width) || null,
          height: Number(stream.height) || null,
          bitrate: Number(stream.bitRate || stream.bitrate) || 0,
        })
      }
    }
  }
  if (Array.isArray(node.streams)) {
    for (const stream of node.streams) {
      const url = typeof stream?.src === 'string' ? stream.src
        : typeof stream?.url === 'string' ? stream.url
        : null
      if (!url || !/mp4/i.test(url) || seen.has(url)) continue
      seen.add(url)
      out.push({
        url,
        width: Number(stream.width) || null,
        height: Number(stream.height) || null,
        bitrate: Number(stream.bitrate || stream.bitRate) || 0,
      })
    }
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') collectMp4Streams(value, out, seen)
  }
}

function extractFromJsonBlobs(html) {
  const blobs = extractEmbeddedJsonBlobs(html)
  const collected = []
  const seen = new Set()
  for (const blob of blobs) collectMp4Streams(blob, collected, seen)
  return collected
}

function fallbackHtmlMp4Scan(html) {
  // LinkedIn's progressive video URLs look like
  // `https://dms.licdn.com/playlist/vid/.../mp4-720p-30fp-crf28/.../...?e=...&v=beta&t=...`
  // — the `.mp4` extension is never present; instead `mp4-NNNp` appears as a
  // path segment. Match any licdn host with `mp4` somewhere in the path.
  const re = /https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.licdn\.com\/[^\s"'<>)\\]*?mp4[^\s"'<>)\\]*/gi
  const seen = new Set()
  const out = []
  let m
  while ((m = re.exec(html)) !== null) {
    const url = m[0]
    if (seen.has(url)) continue
    seen.add(url)
    const dimMatch = url.match(/[-_/](\d{3,4})[xX](\d{3,4})[-_/]/) || url.match(/mp4-(\d{3,4})p/)
    const width = dimMatch && dimMatch[2] ? Number(dimMatch[1]) : null
    const height = dimMatch
      ? Number(dimMatch[2] || dimMatch[1])
      : null
    out.push({ url, width, height, bitrate: 0 })
  }
  return out
}

function findAllVideosInHtml(html) {
  const unescaped = unescapeForwardSlashes(html)
  const og = extractOgVideo(unescaped)
  const blobs = extractFromJsonBlobs(unescaped)
  const regexProgressive = findProgressiveStreamsByRegex(unescaped)
  const flat = fallbackHtmlMp4Scan(unescaped)
  const seen = new Set()
  const merged = []
  for (const stream of [...og, ...blobs, ...regexProgressive, ...flat]) {
    if (seen.has(stream.url)) continue
    seen.add(stream.url)
    merged.push(stream)
  }
  return { og, blobs, regex: regexProgressive, flat, merged }
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
    return {
      label,
      url,
      ua: userAgent,
      status: res.status,
      ok: res.ok,
      htmlLength: html.length,
      html,
    }
  } catch (err) {
    return { label, url, ua: userAgent, status: 0, ok: false, error: String(err?.message || err) }
  } finally {
    clearTimeout(timer)
  }
}

function pickBestStreams(streams) {
  if (streams.length === 0) return []
  // Prefer the highest bitrate; if no bitrate info, the first stream wins.
  const sorted = [...streams].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
  return [sorted[0]]
}

function buildAttempts(validated) {
  const attempts = []
  if (validated.canonicalUrl) {
    attempts.push({ url: validated.canonicalUrl, ua: PREVIEW_UA, label: 'canonical+slackbot' })
  }
  const altUrn = validated.urnType === 'ugcPost' ? 'activity' : 'ugcPost'
  attempts.push(
    { url: `${LINKEDIN_HOST}/embed/feed/update/urn:li:${validated.urnType}:${validated.id}`, ua: DESKTOP_UA, label: `embed-${validated.urnType}` },
    { url: `${LINKEDIN_HOST}/embed/feed/update/urn:li:${altUrn}:${validated.id}`, ua: DESKTOP_UA, label: `embed-${altUrn}` },
    { url: `${LINKEDIN_HOST}/embed/feed/update/urn:li:${validated.urnType}:${validated.id}`, ua: PREVIEW_UA, label: `embed-${validated.urnType}+slackbot` },
  )
  return attempts
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

  const validated = validateLinkedInUrl(payload?.url)
  if (validated.error) return validated.error

  const attempts = buildAttempts(validated)
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
      ogCount: 0,
      blobCount: 0,
      regexCount: 0,
      flatCount: 0,
      sample: null,
    }
    if (fetched.ok && fetched.html) {
      const { og, blobs, regex, flat, merged } = findAllVideosInHtml(fetched.html)
      traceEntry.ogCount = og.length
      traceEntry.blobCount = blobs.length
      traceEntry.regexCount = regex.length
      traceEntry.flatCount = flat.length
      const sampleLen = debugMode ? 8000 : 2000
      traceEntry.sample = fetched.html.slice(0, sampleLen)
      if (merged.length > 0) {
        winningStreams = merged
        trace.push(traceEntry)
        break
      }
    }
    trace.push(traceEntry)
  }

  if (winningStreams.length === 0) {
    console.error('[linkedin-download] no videos found', JSON.stringify({
      input: payload?.url,
      validated: { urnType: validated.urnType, id: validated.id, slug: validated.slug },
      trace,
    }))
    const anyFetchOk = trace.some((t) => t.ok)
    const code = anyFetchOk ? 'no_videos' : 'extract_failed'
    const message = anyFetchOk
      ? 'No public LinkedIn video was found for that URL.'
      : 'Could not read public LinkedIn media for that URL.'
    const status = anyFetchOk ? 404 : 502
    return json({ code, message, trace }, status)
  }

  const best = pickBestStreams(winningStreams)
  const authorPart = validated.author ? sanitizeFilenamePart(validated.author, '') : ''
  const slugPart = validated.slug ? sanitizeFilenamePart(validated.slug, '') : ''
  const joined = [authorPart, slugPart].filter(Boolean).join('-')
  const baseName = sanitizeFilenamePart(joined, `linkedin-${validated.id}`)

  const videos = best.map((stream, i) => {
    const suffix = best.length > 1 ? `-${String(i + 1).padStart(2, '0')}` : ''
    const filename = `${baseName}${suffix}.mp4`
    return {
      url: stream.url,
      proxyUrl: `/.netlify/functions/linkedin-video?url=${encodeURIComponent(stream.url)}&filename=${encodeURIComponent(filename)}`,
      filename,
      width: stream.width,
      height: stream.height,
    }
  })

  if (debugMode) {
    return json({ videos, trace })
  }
  return json({ videos })
}
