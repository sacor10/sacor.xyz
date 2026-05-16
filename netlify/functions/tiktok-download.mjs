/**
 * Resolves video URLs for a public TikTok video post. Accepts canonical
 * (/@user/video/<id>) and short links (vm.tiktok.com/..., tiktok.com/t/...),
 * resolves redirects server-side, fetches the page HTML, and extracts the
 * no-watermark MP4 URL from the embedded JSON state.
 */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 8000
const MAX_REDIRECTS = 5

const VALID_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
])

const SHORT_LINK_HOSTS = new Set(['vm.tiktok.com', 'vt.tiktok.com'])

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

const errorBody = (code, message, status) => json({ code, message }, status)

function isTikTokHost(hostname) {
  return VALID_HOSTS.has(hostname.toLowerCase())
}

function isShortLink(parsed) {
  return SHORT_LINK_HOSTS.has(parsed.hostname.toLowerCase()) ||
    parsed.pathname.startsWith('/t/')
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

function extractVideoId(pathname) {
  const m = pathname.match(/\/video\/(\d+)/)
  return m ? m[1] : null
}

async function resolveShortLink(url) {
  let current = url
  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT },
    })
    const location = res.headers.get('location')
    if (!location) return current
    current = location
    // Check if we've reached a canonical video URL
    if (extractVideoId(new URL(current).pathname)) return current
  }
  return current
}

async function fetchTikTokPage(url) {
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
    if (!res.ok) return { upstreamStatus: res.status }
    const html = await res.text()
    return { html }
  } catch {
    return { upstreamStatus: 502 }
  } finally {
    clearTimeout(timer)
  }
}

function parseVideoData(html, videoId) {
  // Try __UNIVERSAL_DATA_FOR_REHYDRATION__ first (2024+ format)
  const universalMatch = html.match(
    /<script\s+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/
  )
  if (universalMatch) {
    try {
      const data = JSON.parse(universalMatch[1])
      const detail = data?.['__DEFAULT_SCOPE__']?.['webapp.video-detail']
      const itemStruct = detail?.itemInfo?.itemStruct
      if (itemStruct) return { itemStruct }
    } catch { /* fall through */ }
  }

  // Fallback: SIGI_STATE (older format)
  const sigiMatch = html.match(
    /<script\s+id="SIGI_STATE"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/
  )
  if (sigiMatch) {
    try {
      const data = JSON.parse(sigiMatch[1])
      const item = data?.ItemModule?.[videoId]
      if (item) return { itemStruct: item }
    } catch { /* fall through */ }
  }

  return null
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

  const input = payload?.url
  if (typeof input !== 'string' || !input.trim()) {
    return errorBody('invalid_url', 'Enter a public TikTok video URL.', 400)
  }

  let parsed
  try {
    parsed = new URL(input)
  } catch {
    return errorBody('invalid_url', 'Enter a public TikTok video URL.', 400)
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !isTikTokHost(parsed.hostname)) {
    return errorBody('invalid_url', 'Only tiktok.com URLs are supported.', 400)
  }

  // Resolve short links to canonical URL
  let canonicalUrl = input
  if (isShortLink(parsed)) {
    try {
      canonicalUrl = await resolveShortLink(input)
    } catch {
      return errorBody('extract_failed', 'Could not resolve the short link.', 502)
    }
  }

  let canonicalParsed
  try {
    canonicalParsed = new URL(canonicalUrl)
  } catch {
    return errorBody('extract_failed', 'Could not resolve the short link.', 502)
  }

  const videoId = extractVideoId(canonicalParsed.pathname)
  if (!videoId) {
    return errorBody('invalid_url', 'Use a TikTok video URL (/@user/video/<id>).', 400)
  }

  // Fetch the TikTok page
  const result = await fetchTikTokPage(canonicalUrl)
  if (result.upstreamStatus) {
    if (result.upstreamStatus === 404) {
      return errorBody('no_videos', 'No downloadable public TikTok video was found for that URL.', 404)
    }
    return errorBody('extract_failed', 'Could not fetch the TikTok page.', 502)
  }

  // Parse video data from HTML
  const videoData = parseVideoData(result.html, videoId)
  if (!videoData) {
    return errorBody('extract_failed', 'Could not extract video data from the TikTok page.', 502)
  }

  const { itemStruct } = videoData

  // Reject slideshows
  if (itemStruct.imagePost) {
    return errorBody('no_videos', 'Slideshow posts are not supported — videos only.', 404)
  }

  // Extract video URL
  const videoUrl = itemStruct.video?.playAddr || itemStruct.video?.downloadAddr
  if (!videoUrl) {
    return errorBody('no_videos', 'No downloadable public TikTok video was found for that URL.', 404)
  }

  const author = itemStruct.author?.uniqueId || itemStruct.author?.nickname || 'tiktok'
  const filename = `${sanitizeFilenamePart(author, 'tiktok')}-${videoId}.mp4`
  const width = itemStruct.video?.width || null
  const height = itemStruct.video?.height || null

  const proxyUrl = `/.netlify/functions/tiktok-video?url=${encodeURIComponent(videoUrl)}`

  return json({
    videos: [{
      url: videoUrl,
      proxyUrl,
      filename,
      width,
      height,
    }],
  })
}
