import { DownloaderError } from './errors.js'

const VALID_PATH_TYPES = new Set(['p', 'reel', 'tv'])

function isInstagramHost(hostname) {
  const host = hostname.toLowerCase()
  return host === 'instagram.com' || host.endsWith('.instagram.com')
}

export function validateInstagramUrl(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new DownloaderError(
      'invalid_url',
      'Enter a public Instagram Reel or video post URL.',
      400,
    )
  }

  let parsed
  try {
    parsed = new URL(input.trim())
  } catch {
    throw new DownloaderError(
      'invalid_url',
      'Enter a public Instagram Reel or video post URL.',
      400,
    )
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !isInstagramHost(parsed.hostname)) {
    throw new DownloaderError(
      'invalid_url',
      'Only instagram.com Reel or post URLs are supported.',
      400,
    )
  }

  const [type, shortcode] = parsed.pathname.split('/').filter(Boolean)
  if (!VALID_PATH_TYPES.has(type) || !shortcode) {
    throw new DownloaderError(
      'invalid_url',
      'Use a public Instagram /reel/, /p/, or /tv/ URL.',
      400,
    )
  }

  return {
    href: `https://www.instagram.com/${type}/${shortcode}/`,
    shortcode,
    type,
  }
}
