/**
 * Initiates a high-speed pre-muxed video stream resolver job for a YouTube video.
 *
 * Gated behind Google Sign-In session cookie.
 * Supports 4K (2160p), 1440p, 1080p, 720p, 480p, 360p.
 *
 * Returns a task ID + progress URL so the browser can poll savenow's API directly
 * (CORS: *) and receive the download URL without routing video bytes through Netlify.
 * This avoids AWS/datacenter IP blocks on savenow's video CDN.
 */
import sanitize from 'sanitize-filename'
import { readSessionCookie } from './_lib/session.mjs'

const RESOLVER_DOMAINS = ['p.savenow.to', 'p.lbserver.xyz']

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

const errorBody = (code, message, status) => json({ code, message }, status)

function cleanFilename(title, fallback = 'youtube-video') {
  const sanitized = sanitize(title || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return (sanitized || fallback).replace(/[^\w.\- ]+/g, '_')
}

function mapHeightToFormat(height) {
  const h = Number(height) || 0
  if (h >= 2160) return '4k'
  if (h >= 1440) return '1440'
  if (h >= 1080) return '1080'
  if (h >= 720) return '720'
  if (h >= 480) return '480'
  if (h > 0) return '360'
  return '4k'
}

async function initStreamJob(domain, videoUrl, format) {
  const target = `https://${domain}/api/v2/download?format=${encodeURIComponent(format)}&url=${encodeURIComponent(videoUrl)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        Referer: 'https://loader.to/',
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()
    if (data && data.id) return data
  } catch {
    clearTimeout(timer)
  }
  return null
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST', 'Content-Type': 'text/plain' },
    })
  }

  // Gate behind Google Sign-In
  const session = readSessionCookie(req)
  if (!session || !session.email) {
    return errorBody('unauthorized', 'You must sign in with Google to use the online web downloader.', 401)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return errorBody('invalid_json', 'Request body must be valid JSON.', 400)
  }

  const rawUrl = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!rawUrl) {
    return errorBody('invalid_url', 'Enter a valid YouTube video URL.', 400)
  }

  const height = body?.height || 2160
  const format = mapHeightToFormat(height)

  let initData = null
  let activeDomain = RESOLVER_DOMAINS[0]

  for (const domain of RESOLVER_DOMAINS) {
    initData = await initStreamJob(domain, rawUrl, format)
    if (initData) {
      activeDomain = domain
      break
    }
  }

  if (!initData || !initData.id) {
    return errorBody('resolver_error', 'Could not initialize stream resolver for this quality.', 502)
  }

  const safeTitle = cleanFilename(initData.title || 'youtube-video')
  const filename = `${safeTitle}-${height}p.mp4`

  // Return task info so browser can poll progress directly from savenow (CORS: *)
  // The browser's residential IP is not blocked by savenow's video CDN; Netlify's AWS IP would be.
  return json({
    success: true,
    taskId: initData.id,
    progressUrl: `https://${activeDomain}/api/progress?id=${encodeURIComponent(initData.id)}`,
    filename,
    format: initData.format || format,
    title: initData.title,
    thumbnail: initData.info?.image || initData.thumbnail_url || null,
    // If the download URL is already available immediately, return it too
    downloadUrl: initData.download_url || initData.url || null,
  })
}
