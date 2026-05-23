import { DownloaderError } from './errors.js'

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

function invalidUrl(message = 'Enter a YouTube video URL.') {
  return new DownloaderError('invalid_url', message, 400)
}

function isYouTubeHost(hostname) {
  const host = hostname.toLowerCase()
  return (
    host === 'youtube.com'
    || host.endsWith('.youtube.com')
    || host === 'youtu.be'
    || host === 'youtube-nocookie.com'
    || host.endsWith('.youtube-nocookie.com')
  )
}

function firstPathSegment(pathname) {
  return pathname.split('/').filter(Boolean)[0] || ''
}

function extractVideoId(parsed) {
  const host = parsed.hostname.toLowerCase()
  const segments = parsed.pathname.split('/').filter(Boolean)

  if (host === 'youtu.be') return segments[0] || ''
  if (segments[0] === 'watch' || parsed.pathname === '/watch') return parsed.searchParams.get('v') || ''
  if (segments[0] === 'shorts') return segments[1] || ''
  if (segments[0] === 'embed') return segments[1] || ''

  return ''
}

export function validateYouTubeUrl(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw invalidUrl()
  }

  let parsed
  try {
    parsed = new URL(input.trim())
  } catch {
    throw invalidUrl()
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !isYouTubeHost(parsed.hostname)) {
    throw invalidUrl('Only YouTube video URLs are supported.')
  }

  const videoId = extractVideoId(parsed)
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    const shape = firstPathSegment(parsed.pathname) || 'watch'
    throw invalidUrl(`Use a YouTube /watch, youtu.be, /shorts, or /embed video URL. Unsupported target: ${shape}.`)
  }

  return {
    href: `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
  }
}
