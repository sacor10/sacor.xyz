/**
 * Streaming proxy for public TikTok MP4s. TikTok's CDN requires a matching
 * Referer and real-browser User-Agent — direct browser fetches get 403s.
 * Streaming via `new Response(upstream.body, …)` from a Netlify Functions v2
 * handler bypasses the 6 MB Lambda response cap.
 */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 30000
const MAX_BYTES = 200 * 1024 * 1024 // 200 MB hard ceiling

// TikTok rotates CDN subdomains so we use suffix matching
const ALLOWED_SUFFIXES = [
  '.tiktokcdn.com',
  '.tiktokcdn-us.com',
  '.tiktokcdn-eu.com',
  '.tiktokv.com',
  '.tiktokv.us',
  '.byteoversea.com',
  '.muscdn.com',
]

function isAllowedHost(hostname) {
  const host = hostname.toLowerCase()
  return ALLOWED_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))
}

function badRequest(message) {
  return new Response(message, {
    status: 400,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  })
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
  if (parsed.protocol !== 'https:' || !isAllowedHost(parsed.hostname)) {
    return badRequest('Host not allowed.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let upstream
  try {
    upstream = await fetch(parsed.toString(), {
      headers: {
        Accept: '*/*',
        Referer: 'https://www.tiktok.com/',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    })
  } catch {
    clearTimeout(timer)
    return new Response('Upstream fetch failed.', {
      status: 502,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    })
  }

  // Headers received — clear the connect/headers timeout so long downloads
  // aren't aborted mid-stream.
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
  headers.set('Content-Type', upstream.headers.get('content-type') || 'video/mp4')
  if (contentLengthHeader) headers.set('Content-Length', contentLengthHeader)
  headers.set('Cache-Control', 'no-store')

  return new Response(upstream.body, { status: 200, headers })
}
