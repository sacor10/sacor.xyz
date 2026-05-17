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

// TikTok rotates CDN subdomains so we use suffix matching for the dedicated
// CDN families. tiktok.com itself is intentionally NOT a bare suffix — only
// known video-serving subdomain prefixes (matched by TIKTOK_VIDEO_SUBDOMAIN_RE)
// are allowed, so the proxy can't be turned into a generic fetcher for
// www/api/accounts/etc.
const ALLOWED_SUFFIXES = [
  '.tiktokcdn.com',
  '.tiktokcdn-us.com',
  '.tiktokcdn-eu.com',
  '.tiktokv.com',
  '.tiktokv.us',
  '.tiktokv.eu',
  '.byteoversea.com',
  '.bytecdn.cn',
  '.muscdn.com',
  '.ibytedtos.com',
]

// Video-serving subdomains under tiktok.com, optionally with a 2-3 letter
// region label (e.g. v16-webapp-prime.us.tiktok.com, v19.eu.tiktok.com).
const TIKTOK_VIDEO_SUBDOMAIN_RE = /^v\d+[a-z0-9-]*(\.[a-z]{2,3})?\.tiktok\.com$/i

function isAllowedHost(hostname) {
  const host = hostname.toLowerCase()
  if (ALLOWED_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))) {
    return true
  }
  return TIKTOK_VIDEO_SUBDOMAIN_RE.test(host)
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
    console.warn('tiktok-video: rejected host', {
      hostname: parsed.hostname,
      protocol: parsed.protocol,
    })
    return badRequest(`Host not allowed: ${parsed.hostname}`)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  const upstreamHeaders = {
    Accept: '*/*',
    Referer: 'https://www.tiktok.com/',
    'User-Agent': USER_AGENT,
  }
  // TikTok's webapp-prime CDN URLs include tk=tt_chain_token and require the
  // matching cookie value (set when the page that exposed the playAddr was
  // rendered). The metadata function captures it and threads it through here.
  const chainToken = incoming.searchParams.get('tct')
  if (chainToken) {
    upstreamHeaders.Cookie = `tt_chain_token=${chainToken}`
  }

  let upstream
  try {
    upstream = await fetch(parsed.toString(), {
      headers: upstreamHeaders,
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    const reason = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'network error')
    console.warn('tiktok-video: upstream fetch threw', {
      hostname: parsed.hostname,
      reason,
    })
    return new Response(`Upstream fetch failed: ${reason}`, {
      status: 502,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    })
  }

  // Headers received — clear the connect/headers timeout so long downloads
  // aren't aborted mid-stream.
  clearTimeout(timer)

  if (!upstream.ok || !upstream.body) {
    console.warn('tiktok-video: upstream returned non-ok', {
      hostname: parsed.hostname,
      status: upstream.status,
      statusText: upstream.statusText,
      contentType: upstream.headers.get('content-type'),
      hasBody: Boolean(upstream.body),
    })
    return new Response(`Upstream fetch failed: HTTP ${upstream.status}`, {
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
  headers.set('Cache-Control', 'no-store')
  const filenameParam = incoming.searchParams.get('filename')
  const safeName = filenameParam
    ? filenameParam.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'tiktok-video.mp4'
    : 'tiktok-video.mp4'
  headers.set('Content-Disposition', `attachment; filename="${safeName}"`)

  return new Response(upstream.body, { status: 200, headers })
}
