/**
 * Streaming proxy for public Facebook MP4s served from *.fbcdn.net. The browser
 * cannot reliably fetch these URLs directly (CORS, opaque signed query strings
 * with no filename, sometimes Referer-gated). This function fetches server-side
 * with the headers fbcdn expects, then streams the bytes back with a clean
 * Content-Disposition.
 *
 * Streaming via `new Response(upstream.body, …)` from a Netlify Functions v2
 * handler bypasses the 6 MB Lambda response cap that applies to buffered
 * v1-style responses.
 */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 30000
const MAX_BYTES = 200 * 1024 * 1024 // 200 MB hard ceiling

function badRequest(message) {
  return new Response(message, {
    status: 400,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  })
}

function isFbcdnHost(hostname) {
  const host = hostname.toLowerCase()
  return host === 'fbcdn.net' || host.endsWith('.fbcdn.net')
}

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD', 'Content-Type': 'text/plain' },
    })
  }

  const incoming = new URL(req.url)
  const target = incoming.searchParams.get('url')
  if (!target) return badRequest('Missing url parameter.')

  let parsed
  try {
    parsed = new URL(target)
  } catch {
    return badRequest('Invalid url parameter.')
  }
  if (parsed.protocol !== 'https:' || !isFbcdnHost(parsed.hostname)) {
    return badRequest('Host not allowed.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  // Pass through a Range header so iOS Safari's piecemeal video fetch works.
  const rangeHeader = req.headers.get('range')
  const upstreamHeaders = {
    Accept: '*/*',
    Referer: 'https://www.facebook.com/',
    'User-Agent': USER_AGENT,
  }
  if (rangeHeader) upstreamHeaders.Range = rangeHeader

  let upstream
  try {
    upstream = await fetch(parsed.toString(), {
      headers: upstreamHeaders,
      signal: controller.signal,
    })
  } catch {
    clearTimeout(timer)
    return new Response('Upstream fetch failed.', {
      status: 502,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    })
  }

  clearTimeout(timer)

  if (!upstream.ok || !upstream.body) {
    return new Response('Upstream fetch failed.', {
      status: 502,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    })
  }

  const contentLengthHeader = upstream.headers.get('content-length')
  const contentLength = Number(contentLengthHeader || 0)
  if (contentLength && contentLength > MAX_BYTES) {
    return new Response('Video too large.', {
      status: 413,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    })
  }

  const headers = new Headers()
  headers.set('Content-Type', 'video/mp4')
  if (contentLengthHeader) headers.set('Content-Length', contentLengthHeader)
  const contentRange = upstream.headers.get('content-range')
  if (contentRange) headers.set('Content-Range', contentRange)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'no-store')
  const filenameParam = incoming.searchParams.get('filename')
  const safeName = filenameParam
    ? filenameParam.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'facebook-video.mp4'
    : 'facebook-video.mp4'
  headers.set('Content-Disposition', `attachment; filename="${safeName}"`)

  return new Response(upstream.body, { status: upstream.status, headers })
}
