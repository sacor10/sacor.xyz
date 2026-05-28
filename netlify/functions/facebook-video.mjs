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

  // fbcdn is fussy about which headers a non-browser client may send: some
  // signed URLs 403 when a Referer/Origin is present (inverted hotlink
  // protection), others only serve bytes when a Range is set. There's no single
  // header set that works for every URL, so try a few least-to-most decorated
  // variants and stream the first that fbcdn accepts. `null` Range means "send
  // no Range header at all" — distinct from passing through the browser's.
  const browserRange = req.headers.get('range')
  const baseUA = { 'User-Agent': USER_AGENT, Accept: '*/*' }
  const strategies = [
    // 1. Bare GET, no Referer — matches how yt-dlp pulls fbcdn progressive MP4s.
    { label: 'bare', headers: { ...baseUA }, range: browserRange },
    // 2. Range-only, still no Referer.
    { label: 'range', headers: { ...baseUA }, range: browserRange || 'bytes=0-' },
    // 3. Full browser video-fetch headers including the Facebook Referer/Origin.
    {
      label: 'referer',
      headers: {
        ...baseUA,
        Referer: 'https://www.facebook.com/',
        Origin: 'https://www.facebook.com',
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
      },
      range: browserRange || 'bytes=0-',
    },
  ]

  let upstream = null
  let lastStatus = 0
  let lastError = null

  for (const strategy of strategies) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const headers = { ...strategy.headers }
    if (strategy.range) headers.Range = strategy.range
    try {
      const res = await fetch(parsed.toString(), { headers, signal: controller.signal })
      clearTimeout(timer)
      if (res.ok && res.body) {
        upstream = res
        break
      }
      lastStatus = res.status
      // Drain the (small) error body so the socket is freed before retrying.
      await res.body?.cancel().catch(() => {})
      console.error('[facebook-video] strategy rejected', JSON.stringify({
        host: parsed.hostname, strategy: strategy.label, status: res.status,
      }))
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      console.error('[facebook-video] strategy threw', JSON.stringify({
        host: parsed.hostname, strategy: strategy.label,
        aborted: err?.name === 'AbortError', error: String(err?.message || err),
      }))
    }
  }

  if (!upstream) {
    // Surface fbcdn's own status (403 bad signature/hotlink, 404 gone) when we
    // got one; otherwise 504 for a timeout or 502 for any other network error.
    if (lastStatus >= 400) {
      return new Response(`Upstream returned ${lastStatus}.`, {
        status: lastStatus,
        headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
      })
    }
    const aborted = lastError?.name === 'AbortError'
    return new Response(aborted ? 'Upstream timed out.' : 'Upstream fetch failed.', {
      status: aborted ? 504 : 502,
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
