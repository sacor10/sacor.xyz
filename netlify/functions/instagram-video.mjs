/**
 * Streaming proxy for public Instagram MP4s served from *.cdninstagram.com and *.fbcdn.net.
 * The browser cannot reliably fetch these URLs directly due to CORS and signed headers.
 * This function fetches server-side with the headers expected by Instagram CDN,
 * then streams the bytes back with a clean Content-Disposition.
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

function isAllowedHost(hostname) {
  const host = hostname.toLowerCase()
  return (
    host === 'cdninstagram.com' ||
    host.endsWith('.cdninstagram.com') ||
    host === 'fbcdn.net' ||
    host.endsWith('.fbcdn.net') ||
    host === 'instagram.com' ||
    host.endsWith('.instagram.com')
  )
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

  const browserRange = req.headers.get('range')
  const baseUA = { 'User-Agent': USER_AGENT, Accept: '*/*' }
  const strategies = [
    {
      label: 'referer',
      headers: {
        ...baseUA,
        Referer: 'https://www.instagram.com/',
        Origin: 'https://www.instagram.com',
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
      },
      range: browserRange || 'bytes=0-',
    },
    { label: 'bare', headers: { ...baseUA }, range: browserRange },
    { label: 'range', headers: { ...baseUA }, range: browserRange || 'bytes=0-' },
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
      await res.body?.cancel().catch(() => {})
    } catch (err) {
      clearTimeout(timer)
      lastError = err
    }
  }

  if (!upstream) {
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
    ? filenameParam.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'instagram-video.mp4'
    : 'instagram-video.mp4'
  headers.set('Content-Disposition', `attachment; filename="${safeName}"`)

  return new Response(upstream.body, { status: upstream.status, headers })
}
