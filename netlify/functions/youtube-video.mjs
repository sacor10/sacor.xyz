/**
 * Streaming proxy for YouTube media streams from googlevideo.com.
 *
 * Browsers cannot directly fetch googlevideo URLs because of CORS,
 * User-Agent checks, and missing Content-Disposition headers.
 * This proxy streams chunks directly back to the client.
 */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 60000

function badRequest(message) {
  return new Response(message, {
    status: 400,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  })
}

function isGoogleVideoHost(hostname) {
  const host = hostname.toLowerCase()
  return host.endsWith('.googlevideo.com') || host === 'googlevideo.com'
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

  if (parsed.protocol !== 'https:' || !isGoogleVideoHost(parsed.hostname)) {
    return badRequest('Host not allowed.')
  }

  const browserRange = req.headers.get('range')
  const reqHeaders = {
    'User-Agent': USER_AGENT,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Mode': 'navigate',
  }
  if (browserRange) {
    reqHeaders.Range = browserRange
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: reqHeaders,
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!upstream.ok) {
      return new Response(`Upstream returned ${upstream.status}.`, {
        status: upstream.status,
        headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
      })
    }

    const headers = new Headers()
    const contentType = upstream.headers.get('content-type') || 'video/mp4'
    headers.set('Content-Type', contentType)
    
    const contentLength = upstream.headers.get('content-length')
    if (contentLength) headers.set('Content-Length', contentLength)
    
    const contentRange = upstream.headers.get('content-range')
    if (contentRange) headers.set('Content-Range', contentRange)
    
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Cache-Control', 'no-store')

    const filenameParam = incoming.searchParams.get('filename')
    const safeName = filenameParam
      ? filenameParam.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'youtube-video.mp4'
      : 'youtube-video.mp4'
    headers.set('Content-Disposition', `attachment; filename="${safeName}"`)

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (err) {
    clearTimeout(timer)
    const aborted = err?.name === 'AbortError'
    return new Response(aborted ? 'Upstream timed out.' : 'Upstream fetch failed.', {
      status: aborted ? 504 : 502,
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
    })
  }
}
