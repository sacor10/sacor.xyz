/**
 * Resolves a direct high-speed download link for a YouTube video at a specific quality.
 *
 * Gated behind Google Sign-In session cookie.
 * Supports 4K (2160p), 1440p, 1080p, 720p, 480p, 360p, and mp3 audio.
 * Pre-muxes adaptive audio/video server-side so users get complete 4K MP4 files with sound.
 */
import sanitize from 'sanitize-filename'
import { readSessionCookie } from './_lib/session.mjs'

const RESOLVER_DOMAINS = ['p.savenow.to', 'p.lbserver.xyz']
const POLL_INTERVAL_MS = 1000
const MAX_WAIT_MS = 35000

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

async function requestStreamInit(domain, videoUrl, format) {
  const target = `https://${domain}/api/v2/download?format=${encodeURIComponent(format)}&url=${encodeURIComponent(videoUrl)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        Referer: 'https://loader.to/',
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

async function pollProgress(domain, taskId) {
  const progressUrl = `https://${domain}/api/progress?id=${encodeURIComponent(taskId)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const res = await fetch(progressUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://loader.to/',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (res.ok) {
      return await res.json()
    }
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
    initData = await requestStreamInit(domain, rawUrl, format)
    if (initData) {
      activeDomain = domain
      break
    }
  }

  if (!initData || !initData.id) {
    return errorBody('resolver_error', 'Could not initialize stream resolver for this quality.', 502)
  }

  // If download URL is immediately available
  if (initData.download_url) {
    const safeTitle = cleanFilename(initData.title || 'youtube-video')
    return json({
      success: true,
      downloadUrl: initData.download_url,
      filename: `${safeTitle}-${height}p.mp4`,
      format: initData.format || format,
      title: initData.title,
    })
  }

  // Poll progress
  const startTime = Date.now()
  let downloadUrl = null

  while (!downloadUrl && Date.now() - startTime < MAX_WAIT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    const prog = await pollProgress(activeDomain, initData.id)
    if (prog && prog.success === 1 && prog.download_url) {
      downloadUrl = prog.download_url
      break
    }
  }

  if (!downloadUrl) {
    return errorBody('timeout', 'Stream preparation timed out. Please try again or use the Desktop App.', 504)
  }

  const safeTitle = cleanFilename(initData.title || 'youtube-video')
  const filename = `${safeTitle}-${height}p.mp4`

  return json({
    success: true,
    downloadUrl,
    proxyUrl: `/.netlify/functions/youtube-video?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(filename)}`,
    filename,
    format: initData.format || format,
    title: initData.title,
  })
}
