/**
 * Resolves video format details for a public YouTube video.
 *
 * Gated behind a valid Google Sign-In session cookie.
 * Extracts title, thumbnail, duration, and highest available resolutions
 * (including 4K / 2160p, 1440p, 1080p, 720p, etc.) and matching audio tracks.
 */
import youtubedl from 'youtube-dl-exec'
import sanitize from 'sanitize-filename'
import { readSessionCookie } from './_lib/session.mjs'

const FETCH_TIMEOUT_MS = 25000

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

  // Validate YouTube URL
  let parsedUrl
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    return errorBody('invalid_url', 'Invalid URL format.', 400)
  }

  const hostname = parsedUrl.hostname.toLowerCase()
  const isYoutube =
    hostname === 'youtube.com' ||
    hostname === 'www.youtube.com' ||
    hostname === 'm.youtube.com' ||
    hostname === 'youtu.be'

  if (!isYoutube) {
    return errorBody('invalid_url', 'Only YouTube URLs (youtube.com, youtu.be) are supported.', 400)
  }

  try {
    // Run yt-dlp to inspect format list
    const info = await youtubedl(rawUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: false,
    }, {
      timeout: FETCH_TIMEOUT_MS,
    })

    if (!info || !Array.isArray(info.formats)) {
      return errorBody('not_found', 'Could not retrieve video formats for this YouTube URL.', 404)
    }

    const title = info.title || 'YouTube Video'
    const duration = info.duration || 0
    const thumbnail = info.thumbnail || ''
    const safeTitle = cleanFilename(title)

    // Separate video formats and audio formats
    const allFormats = info.formats.filter((f) => f.url && (f.protocol === 'https' || f.protocol === 'http'))

    // Find best audio track (preferably m4a / aac or opus)
    const audioFormats = allFormats.filter((f) => f.vcodec === 'none' && f.acodec !== 'none')
    audioFormats.sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))
    const bestAudio = audioFormats[0] || null

    // Find video streams grouped by resolution
    const videoFormats = allFormats.filter((f) => f.vcodec !== 'none')

    // Find progressive combined format (has video AND audio)
    const progressiveFormats = videoFormats.filter((f) => f.acodec !== 'none')
    progressiveFormats.sort((a, b) => (b.height || 0) - (a.height || 0))

    // Build unique quality options (e.g. 2160p (4K), 1440p (2K), 1080p, 720p, 480p, 360p)
    const qualityMap = new Map()

    for (const f of videoFormats) {
      const height = f.height || 0
      if (!height) continue

      const label = height >= 2160 ? '2160p (4K)'
        : height >= 1440 ? '1440p (2K)'
        : height >= 1080 ? '1080p (Full HD)'
        : height >= 720 ? '720p (HD)'
        : `${height}p`

      // If we don't have this resolution yet, or if this stream has a higher bitrate/fps, record it
      if (!qualityMap.has(height)) {
        qualityMap.set(height, {
          height,
          label,
          fps: f.fps || 30,
          formatId: f.format_id,
          ext: f.ext,
          vcodec: f.vcodec,
          filesize: f.filesize || f.filesize_approx || null,
          videoUrl: f.url,
          videoProxyUrl: `/.netlify/functions/youtube-video?url=${encodeURIComponent(f.url)}&filename=${encodeURIComponent(`${safeTitle}-${height}p.${f.ext || 'mp4'}`)}`,
          hasAudio: f.acodec !== 'none',
          needsMux: f.acodec === 'none',
        })
      }
    }

    // Sort qualities descending by height
    const availableQualities = Array.from(qualityMap.values()).sort((a, b) => b.height - a.height)

    const audioOption = bestAudio ? {
      formatId: bestAudio.format_id,
      ext: bestAudio.ext || 'm4a',
      abr: bestAudio.abr || 128,
      filesize: bestAudio.filesize || bestAudio.filesize_approx || null,
      audioUrl: bestAudio.url,
      audioProxyUrl: `/.netlify/functions/youtube-video?url=${encodeURIComponent(bestAudio.url)}&filename=${encodeURIComponent(`${safeTitle}.m4a`)}`,
    } : null

    return json({
      id: info.id,
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
