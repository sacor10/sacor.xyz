/**
 * Resolves video URLs for a public X/Twitter status post via the public
 * syndication endpoint, then returns JSON metadata. The browser fetches the
 * MP4(s) directly from videos.twimg.com — keeping bytes out of the function
 * lets us stay under the 6 MB Lambda response cap.
 */
const SYNDICATION_HOST = 'https://cdn.syndication.twimg.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 8000

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

const errorBody = (code, message, status) => json({ code, message }, status)

function isXHost(hostname) {
  const host = hostname.toLowerCase()
  return host === 'x.com'
    || host.endsWith('.x.com')
    || host === 'twitter.com'
    || host.endsWith('.twitter.com')
}

function validateXUrl(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return { error: errorBody('invalid_url', 'Enter a public X/Twitter post URL.', 400) }
  }
  let parsed
  try {
    parsed = new URL(input)
  } catch {
    return { error: errorBody('invalid_url', 'Enter a public X/Twitter post URL.', 400) }
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !isXHost(parsed.hostname)) {
    return { error: errorBody('invalid_url', 'Only x.com and twitter.com post URLs are supported.', 400) }
  }
  const segments = parsed.pathname.split('/').map((s) => s.trim()).filter(Boolean)
  const statusIndex = segments.findIndex((s) => s.toLowerCase() === 'status')
  const statusId = segments[statusIndex + 1]
  if (statusIndex < 0 || !/^\d+$/.test(statusId || '')) {
    return { error: errorBody('invalid_url', 'Use a public X/Twitter /status/<id> URL.', 400) }
  }
  return { id: statusId }
}

/**
 * Derives the syndication "token" param the way the public twitter-embed
 * client does. The algorithm is undocumented but stable.
 */
function syndicationToken(statusId) {
  return ((Number(statusId) / 1e15) * Math.PI)
    .toString(6 ** 2)
    .replace(/(0+|\.)/g, '')
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

function pickBestVariant(variants) {
  if (!Array.isArray(variants)) return null
  const mp4 = variants.filter((v) => v && v.content_type === 'video/mp4' && typeof v.url === 'string')
  if (mp4.length === 0) return null
  mp4.sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))
  return mp4[0]
}

function dimensionsFromVariant(variantUrl, fallbackSizes) {
  const m = typeof variantUrl === 'string' ? variantUrl.match(/\/(\d+)x(\d+)\//) : null
  if (m) return { width: Number(m[1]), height: Number(m[2]) }
  const large = fallbackSizes?.large
  if (large?.w && large?.h) return { width: Number(large.w), height: Number(large.h) }
  return { width: null, height: null }
}

function collectVideos(payload, statusId, titleHint) {
  const media = Array.isArray(payload?.mediaDetails) ? payload.mediaDetails : []
  const titleBase = sanitizeFilenamePart(titleHint, `tweet-${statusId}`)
  const out = []
  let index = 0

  for (const item of media) {
    if (!item) continue
    const type = String(item.type || '').toLowerCase()
    if (type !== 'video' && type !== 'animated_gif') continue
    const best = pickBestVariant(item.video_info?.variants)
    if (!best) continue
    index += 1
    const { width, height } = dimensionsFromVariant(best.url, item.sizes)
    const suffix = media.filter((m) => m && (m.type === 'video' || m.type === 'animated_gif')).length > 1
      ? `-${String(index).padStart(2, '0')}`
      : ''
    const filename = `${titleBase}${suffix}.mp4`
    out.push({
      url: best.url,
      proxyUrl: `/.netlify/functions/x-video?url=${encodeURIComponent(best.url)}&filename=${encodeURIComponent(filename)}`,
      filename,
      width,
      height,
    })
  }

  return out
}

async function fetchSyndication(statusId) {
  const params = new URLSearchParams({
    id: statusId,
    token: syndicationToken(statusId),
    lang: 'en',
  })
  const url = `${SYNDICATION_HOST}/tweet-result?${params.toString()}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    })
    if (res.status === 404) return { notFound: true }
    if (!res.ok) return { upstreamStatus: res.status }
    const body = await res.json().catch(() => null)
    if (!body || typeof body !== 'object') return { upstreamStatus: 502 }
    return { body }
  } catch {
    return { upstreamStatus: 502 }
  } finally {
    clearTimeout(timer)
  }
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

  const validated = validateXUrl(payload?.url)
  if (validated.error) return validated.error

  const result = await fetchSyndication(validated.id)
  if (result.notFound) {
    return errorBody('no_videos', 'No public X/Twitter videos were found for that URL.', 404)
  }
  if (result.upstreamStatus) {
    return errorBody('extract_failed', 'Could not read public X/Twitter media for that URL.', 502)
  }

  const titleHint = result.body.text
    ? result.body.text.split('\n')[0]
    : result.body.user?.screen_name
      ? `tweet-${result.body.user.screen_name}-${validated.id}`
      : `tweet-${validated.id}`

  const videos = collectVideos(result.body, validated.id, titleHint)
  if (videos.length === 0) {
    return errorBody('no_videos', 'No public X/Twitter videos were found for that URL.', 404)
  }

  return json({ videos })
}
