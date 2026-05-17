/**
 * Resolves video URLs for a public LinkedIn post via the public embed endpoint
 * (https://www.linkedin.com/embed/feed/update/urn:li:<urnType>:<id>), then
 * returns JSON metadata. The browser fetches the MP4(s) via the licdn proxy —
 * keeping bytes out of the function lets us stay under the 6 MB Lambda cap.
 */
const EMBED_HOST = 'https://www.linkedin.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
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
    return { urnType: urnMatch[1], id: urnMatch[2], slug: null, author: null }
  }
  const slugMatch = parsed.pathname.match(SLUG_RE)
  if (slugMatch) {
    const postsMatch = parsed.pathname.match(/\/posts\/([^/_]+)_(.+)$/)
    const author = postsMatch ? postsMatch[1] : null
    const slugRaw = postsMatch
      ? postsMatch[2].replace(SLUG_RE, '')
      : null
    return { urnType: slugMatch[1], id: slugMatch[2], slug: slugRaw, author }
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

function extractEmbeddedJsonBlobs(html) {
  const blobs = []
  const patterns = [
    /<code[^>]*>([\s\S]*?)<\/code>/g,
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g,
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
        if (!url || !/\.mp4/i.test(url) || seen.has(url)) continue
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
      if (!url || !/\.mp4/i.test(url) || seen.has(url)) continue
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

function fallbackHtmlMp4Scan(html) {
  const re = /https:\/\/(?:dms|media|static)\.licdn\.com\/[^\s"'<>]+?\.mp4(?:\?[^\s"'<>]*)?/g
  const seen = new Set()
  const out = []
  let m
  while ((m = re.exec(html)) !== null) {
    const url = m[0]
    if (seen.has(url)) continue
    seen.add(url)
    const dimMatch = url.match(/[-_](\d{3,4})[xX](\d{3,4})/)
    out.push({
      url,
      width: dimMatch ? Number(dimMatch[1]) : null,
      height: dimMatch ? Number(dimMatch[2]) : null,
      bitrate: 0,
    })
  }
  return out
}

function pickBestStreams(streams) {
  if (streams.length === 0) return []
  const sorted = [...streams].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
  return [sorted[0]]
}

async function fetchEmbed(urnType, id) {
  const url = `${EMBED_HOST}/embed/feed/update/urn:li:${urnType}:${id}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    })
    if (res.status === 404) return { notFound: true }
    if (!res.ok) return { upstreamStatus: res.status }
    const html = await res.text()
    return { html }
  } catch {
    return { upstreamStatus: 502 }
  } finally {
    clearTimeout(timer)
  }
}

function findVideosInHtml(html) {
  const blobs = extractEmbeddedJsonBlobs(html)
  const collected = []
  const seen = new Set()
  for (const blob of blobs) collectMp4Streams(blob, collected, seen)
  if (collected.length === 0) {
    return fallbackHtmlMp4Scan(html)
  }
  return collected
}

export default async (req) => {
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

  // Try the URN type from the URL first, fall back to the other.
  const primary = validated.urnType
  const fallback = primary === 'ugcPost' ? 'activity' : 'ugcPost'

  let result = await fetchEmbed(primary, validated.id)
  let foundStreams = []
  if (result.html) {
    foundStreams = findVideosInHtml(result.html)
  }
  if (foundStreams.length === 0 && !result.upstreamStatus) {
    const alt = await fetchEmbed(fallback, validated.id)
    if (alt.html) {
      foundStreams = findVideosInHtml(alt.html)
      if (foundStreams.length > 0) result = alt
    } else if (alt.notFound && result.notFound) {
      return errorBody('no_videos', 'No public LinkedIn video was found for that URL.', 404)
    } else if (alt.upstreamStatus && !result.html) {
      return errorBody('extract_failed', 'Could not read public LinkedIn media for that URL.', 502)
    }
  }

  if (result.notFound && foundStreams.length === 0) {
    return errorBody('no_videos', 'No public LinkedIn video was found for that URL.', 404)
  }
  if (result.upstreamStatus && foundStreams.length === 0) {
    return errorBody('extract_failed', 'Could not read public LinkedIn media for that URL.', 502)
  }
  if (foundStreams.length === 0) {
    return errorBody('no_videos', 'No public LinkedIn video was found for that URL.', 404)
  }

  const best = pickBestStreams(foundStreams)
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

  return json({ videos })
}
