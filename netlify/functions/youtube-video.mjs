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

function isAllowedStreamHost(hostname) {
  const host = hostname.toLowerCase()
  return (
    host.endsWith('.googlevideo.com') ||
    host === 'googlevideo.com' ||
    host.endsWith('.savenow.to') ||
    host === 'savenow.to' ||
    host.endsWith('.lbserver.xyz') ||
    host === 'lbserver.xyz'
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

  if (parsed.protocol !== 'https:' || !isAllowedStreamHost(parsed.hostname)) {
    return badRequest('Host not allowed.')
  }

  const browserRange = req.headers.get('range') || 'bytes=0-'
  const targetIp = parsed.searchParams.get('ip') || ''

  const baseHeaders = {
    'User-Agent': USER_AGENT,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Mode': 'navigate',
    Range: browserRange,
  }

  // googlevideo enforces IP binding where the media URL's signed ?ip= parameter
  // must match the requester's IP or forwarded origin. If we are proxying from
  // cloud serverless (Netlify/AWS), we forward client and resolution IP headers.
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || targetIp

  const strategies = [
    // 1. Forwarded client IP and target signed IP
    {
      label: 'forwarded-ip',
      headers: {
        ...baseHeaders,
        ...(targetIp ? { 'X-Forwarded-For': targetIp, 'Client-IP': targetIp, 'X-Real-IP': targetIp } : {}),
        Referer: 'https://www.youtube.com/',
      },
    },
    // 2. Client IP as forwarded by Netlify
    {
      label: 'client-ip',
      headers: {
        ...baseHeaders,
        ...(clientIp ? { 'X-Forwarded-For': clientIp, 'Client-IP': clientIp, 'X-Real-IP': clientIp } : {}),
      },
    },
    // 3. YouTube referer with browser UA
    {
      label: 'youtube-referer',
      headers: {
        ...baseHeaders,
        Referer: 'https://www.youtube.com/',
        Origin: 'https://www.youtube.com',
      },
    },
    // 4. Bare range request
    {
      label: 'bare-range',
      headers: {
        ...baseHeaders,
      },
    },
  ]

  let upstream = null
  let lastStatus = 0

  for (const strategy of strategies) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(parsed.toString(), {
        headers: strategy.headers,
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (res.ok && res.body) {
        upstream = res
        break
      }
      lastStatus = res.status
      await res.body?.cancel().catch(() => {})
    } catch {
      clearTimeout(timer)
    }
  }

  if (!upstream) {
    return new Response(`Upstream returned ${lastStatus || 502}.`, {
      status: lastStatus || 502,
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
}
