/**
 * Resolves video format details for a public YouTube video.
 *
 * Gated behind a valid Google Sign-In session cookie.
 * Extracts title, thumbnail, duration, and highest available resolutions
 * (including 4K / 2160p, 1440p, 1080p, 720p, etc.) and matching audio tracks.
 *
 * Uses pure HTTP resolver logic with Invidious API instances and YouTube oEmbed
 * so it runs natively inside serverless Node.js environments (Netlify/AWS Lambda)
 * without requiring system python3 or external binaries.
 */
import sanitize from 'sanitize-filename'
import { readSessionCookie } from './_lib/session.mjs'

const FETCH_TIMEOUT_MS = 8000

// Reliable Invidious API instances pool for format resolution
const INVIDIOUS_INSTANCES = [
  'https://invidious.f5.si',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.tiekoetter.com',
  'https://yt.chocolatemoo53.com',
]

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

function extractYouTubeId(urlStr) {
  try {
    const parsed = new URL(urlStr)
    const hostname = parsed.hostname.toLowerCase()

    if (hostname === 'youtu.be') {
      return parsed.pathname.replace(/^\/+/, '').split('/')[0] || null
    }

    if (
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'm.youtube.com'
    ) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v') || null
      }
      if (parsed.pathname.startsWith('/shorts/') || parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/')[2] || null
      }
    }
  } catch {
    return null
  }
  return null
}

async function fetchFromInvidious(videoId) {
  for (const instance of INVIDIOUS_INSTANCES) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const resp = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (resp.ok) {
        const data = await resp.json()
        if (data && Array.isArray(data.adaptiveFormats) && data.adaptiveFormats.length > 0) {
          return data
        }
      }
    } catch {
      clearTimeout(timer)
    }
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

  // Gate behind Google Sign-In session
  const session = readSessionCookie(req)
  if (!session || !session.email) {
    return errorBody(
      'unauthorized',
      'You must sign in with Google to use the online web downloader.',
      401,
    )
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

  const videoId = extractYouTubeId(rawUrl)
  if (!videoId) {
    return errorBody('invalid_url', 'Could not detect a valid YouTube video ID from that link.', 400)
  }

  try {
    const data = await fetchFromInvidious(videoId)
    if (!data) {
      return errorBody(
        'not_found',
        'Could not retrieve streaming formats for this video. Please try again or download via Desktop App.',
        404,
      )
    }

    const title = data.title || 'YouTube Video'
    const duration = data.lengthSeconds || 0
    // Use official direct YouTube CDN image URL with videoId to avoid Invidious Anubis bot blocks
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    const safeTitle = cleanFilename(title)

    const allFormats = data.adaptiveFormats.filter((f) => f.url && f.url.startsWith('http'))

    // Audio formats
    const audioFormats = allFormats.filter(
      (f) =>
        f.type?.startsWith('audio') ||
        f.audioQuality ||
        (!f.resolution && !f.qualityLabel && f.bitrate),
    )
    audioFormats.sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0))
    const bestAudio = audioFormats[0] || null

    // Video formats
    const videoFormats = allFormats.filter((f) => f.resolution || f.qualityLabel)

    // Build quality map (2160p (4K), 1440p (2K), 1080p, 720p, etc.)
    const qualityMap = new Map()

    for (const f of videoFormats) {
      const rawRes = f.resolution || f.qualityLabel || ''
      const heightMatch = String(rawRes).match(/(\d{3,4})p?/)
      const height = heightMatch ? parseInt(heightMatch[1], 10) : 0
      if (!height) continue

      const label =
        height >= 2160
          ? '2160p (4K)'
          : height >= 1440
            ? '1440p (2K)'
            : height >= 1080
              ? '1080p (Full HD)'
              : height >= 720
                ? '720p (HD)'
                : `${height}p`

      const ext = (f.container || f.type || '').includes('webm') ? 'webm' : 'mp4'

      if (!qualityMap.has(height)) {
        qualityMap.set(height, {
          height,
          label,
          fps: f.fps || 30,
          formatId: f.itag || String(height),
          ext,
          vcodec: f.encoding || null,
          filesize: f.contentLength ? parseInt(f.contentLength, 10) : null,
          videoUrl: f.url,
          videoProxyUrl: `/.netlify/functions/youtube-video?url=${encodeURIComponent(f.url)}&filename=${encodeURIComponent(`${safeTitle}-${height}p.${ext}`)}`,
          hasAudio: false,
          needsMux: true,
        })
      }
    }

    const availableQualities = Array.from(qualityMap.values()).sort(
      (a, b) => b.height - a.height,
    )

    const audioOption = bestAudio
      ? {
          formatId: bestAudio.itag || 'audio',
          ext: (bestAudio.container || bestAudio.type || '').includes('webm') ? 'webm' : 'm4a',
          abr: bestAudio.bitrate ? Math.round(bestAudio.bitrate / 1000) : 128,
          filesize: bestAudio.contentLength ? parseInt(bestAudio.contentLength, 10) : null,
          audioUrl: bestAudio.url,
          audioProxyUrl: `/.netlify/functions/youtube-video?url=${encodeURIComponent(bestAudio.url)}&filename=${encodeURIComponent(`${safeTitle}.m4a`)}`,
        }
      : null

    return json({
      id: videoId,
      title,
      safeFilename: safeTitle,
      duration,
      thumbnail,
      qualities: availableQualities,
      audio: audioOption,
    })
  } catch (err) {
    console.error('[youtube-download] Error extracting video:', err)
    return errorBody('extract_failed', err?.message || 'Failed to extract video information from YouTube.', 500)
  }
}
