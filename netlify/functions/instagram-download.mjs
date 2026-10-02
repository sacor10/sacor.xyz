/**
 * Resolves video URLs for a public Instagram Reel or post.
 * Uses Googlebot / social crawler requests to obtain the server-rendered HTML
 * and extracts progressive MP4 video streams without requiring login or a separate daemon.
 */
import sanitize from 'sanitize-filename'

const FETCH_TIMEOUT_MS = 15000
const VALID_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'instagr.am'])
const VALID_TYPES = new Set(['p', 'reel', 'reels', 'tv'])

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

const errorBody = (code, message, status) => json({ code, message }, status)

function isInstagramHost(hostname) {
  const host = hostname.toLowerCase()
  return VALID_HOSTS.has(host) || host.endsWith('.instagram.com')
}

function validateInstagramUrl(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return { error: errorBody('invalid_url', 'Enter a public Instagram Reel or video post URL.', 400) }
  }
  let parsed
  try {
    parsed = new URL(input.trim())
  } catch {
    return { error: errorBody('invalid_url', 'Enter a public Instagram Reel or video post URL.', 400) }
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !isInstagramHost(parsed.hostname)) {
    return { error: errorBody('invalid_url', 'Only instagram.com Reel or post URLs are supported.', 400) }
  }
  const segments = parsed.pathname.split('/').map((s) => s.trim()).filter(Boolean)
  const type = segments[0]?.toLowerCase()
  const shortcode = segments[1]
  if (!VALID_TYPES.has(type) || !shortcode) {
    return { error: errorBody('invalid_url', 'Use a public Instagram /reel/, /p/, or /tv/ URL.', 400) }
  }
  return {
    type,
    shortcode,
    canonicalUrl: `https://www.instagram.com/${type}/${shortcode}/`,
  }
}

function cleanFilename(title, fallback = 'instagram-video') {
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

  let body
  try {
    body = await req.json()
  } catch {
    return errorBody('invalid_json', 'Request body must be valid JSON.', 400)
  }

  const validated = validateInstagramUrl(body?.url)
  if (validated.error) return validated.error
  const { canonicalUrl, shortcode } = validated

  const userAgents = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  ]

  let html = ''
  let fetchError = null

  for (const ua of userAgents) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(canonicalUrl, {
        headers: {
          'User-Agent': ua,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (res.ok) {
        html = await res.text()
        if (html.includes('video_versions') || html.includes('.mp4')) {
          break
        }
      }
    } catch (err) {
      clearTimeout(timer)
      fetchError = err
    }
  }

  if (!html) {
    console.error('[instagram-download] fetch failed for', canonicalUrl, fetchError)
    return errorBody('extract_failed', 'Could not read public Instagram media for that URL.', 502)
  }

  // Extract title/caption
  let title = `instagram-${shortcode}`
  const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
  if (titleMatch) {
    title = titleMatch[1]
      .replace(/&quot;/g, '"')
      .replace(/&#x[0-9a-fA-F]+;/g, '')
      .replace(/&amp;/g, '&')
      .trim()
  }

  // Extract videos from video_versions
  const matches = [...html.matchAll(/"video_versions"\s*:\s*(\[[^\]]+\])/g)]
  const videos = []
  const seenUrls = new Set()
  const baseTitle = cleanFilename(title, `instagram-${shortcode}`)

  for (const m of matches) {
    try {
      const list = JSON.parse(m[1])
      // Find progressive MP4 (or best video candidate)
      const best = list.find((v) => v.url && v.url.includes('.mp4')) || list[0]
      if (best?.url && !seenUrls.has(best.url)) {
        seenUrls.add(best.url)
        const idx = videos.length + 1
        const itemFilename = matches.length > 1
          ? `${String(idx).padStart(2, '0')}-${baseTitle}.mp4`
          : `${baseTitle}.mp4`

        videos.push({
          url: best.url,
          proxyUrl: `/.netlify/functions/instagram-video?url=${encodeURIComponent(best.url)}&filename=${encodeURIComponent(itemFilename)}`,
          filename: itemFilename,
          width: best.width || null,
          height: best.height || null,
          id: shortcode,
          title,
        })
      }
    } catch {}
  }

  // Fallback: search for progressive MP4 URLs in HTML if video_versions wasn't found
  if (videos.length === 0) {
    const mp4Matches = [...html.matchAll(/https?:\\\/\\\/[^"'\s]*?cdninstagram\.com[^"'\s]*?\.mp4[^"'\s]*/g)]
    for (const m of mp4Matches) {
      const unescaped = m[0].replace(/\\\//g, '/').replace(/\\u0026/g, '&')
      if (!seenUrls.has(unescaped) && unescaped.includes('scontent')) {
        seenUrls.add(unescaped)
        const filename = `${baseTitle}.mp4`
        videos.push({
          url: unescaped,
          proxyUrl: `/.netlify/functions/instagram-video?url=${encodeURIComponent(unescaped)}&filename=${encodeURIComponent(filename)}`,
          filename,
          width: null,
          height: null,
          id: shortcode,
          title,
        })
        break
      }
    }
  }

  if (videos.length === 0) {
    return errorBody(
      'no_videos',
      'No downloadable public Instagram videos were found for that URL. Photo-only or private posts are not supported.',
      404,
    )
  }

  return json({ videos })
}
