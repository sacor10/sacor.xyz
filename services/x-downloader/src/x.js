import { DownloaderError } from './errors.js'

function isXHost(hostname) {
  const host = hostname.toLowerCase()
  return host === 'x.com'
    || host.endsWith('.x.com')
    || host === 'twitter.com'
    || host.endsWith('.twitter.com')
}

function cleanSegments(pathname) {
  return pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

export function validateXUrl(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new DownloaderError(
      'invalid_url',
      'Enter a public X/Twitter post URL.',
      400,
    )
  }

  let parsed
  try {
    parsed = new URL(input)
  } catch {
    throw new DownloaderError(
      'invalid_url',
      'Enter a public X/Twitter post URL.',
      400,
    )
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !isXHost(parsed.hostname)) {
    throw new DownloaderError(
      'invalid_url',
      'Only x.com and twitter.com post URLs are supported.',
      400,
    )
  }

  const segments = cleanSegments(parsed.pathname)
  const statusIndex = segments.findIndex((segment) => segment.toLowerCase() === 'status')
  const statusId = segments[statusIndex + 1]

  if (statusIndex < 0 || !/^\d+$/.test(statusId || '')) {
    throw new DownloaderError(
      'invalid_url',
      'Use a public X/Twitter /status/<id> URL.',
      400,
    )
  }

  return {
    href: `https://x.com/${segments.slice(0, statusIndex + 2).join('/')}`,
    id: statusId,
  }
}
