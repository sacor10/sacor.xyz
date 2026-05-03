import sanitize from 'sanitize-filename'
import youtubedl from 'youtube-dl-exec'
import { DownloaderError, NoVideosError } from './errors.js'

const VIDEO_EXTENSIONS = new Set(['mp4'])
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function isHttpUrl(value) {
  if (typeof value !== 'string') return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function cleanExt(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeExt(value) {
  const ext = cleanExt(value) || 'mp4'
  return VIDEO_EXTENSIONS.has(ext) ? ext : 'mp4'
}

function hasMp4Url(value) {
  try {
    const parsed = new URL(value)
    return /\.mp4$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

function candidateScore(candidate) {
  const hasAudio = candidate.acodec && candidate.acodec !== 'none'
  const height = Number(candidate.height || 0)
  const tbr = Number(candidate.tbr || candidate.vbr || 0)
  const size = Number(candidate.filesize || candidate.filesize_approx || 0)
  return (hasAudio ? 1_000_000_000 : 0) + height * 1_000_000 + tbr * 1000 + size
}

function isVideoCandidate(candidate) {
  if (!candidate || !isHttpUrl(candidate.url)) return false
  const ext = cleanExt(candidate.ext)
  const protocol = String(candidate.protocol || '').toLowerCase()
  const hasVideoCodec = typeof candidate.vcodec === 'string' && candidate.vcodec !== 'none'
  const hasDirectMp4 = VIDEO_EXTENSIONS.has(ext) || hasMp4Url(candidate.url)
  return !protocol.includes('m3u8') && (hasDirectMp4 || (hasVideoCodec && !ext))
}

function flattenEntries(info) {
  const flattened = []

  const walk = (node) => {
    if (!node) return
    if (Array.isArray(node.entries) && node.entries.length > 0) {
      node.entries.forEach(walk)
      return
    }
    flattened.push(node)
  }

  walk(info)
  return flattened
}

function pickVideoCandidate(item) {
  const candidates = [
    ...(Array.isArray(item.requested_downloads) ? item.requested_downloads : []),
    ...(Array.isArray(item.requested_formats) ? item.requested_formats : []),
    ...(Array.isArray(item.formats) ? item.formats : []),
    item,
  ].filter(isVideoCandidate)

  candidates.sort((a, b) => candidateScore(b) - candidateScore(a))
  return candidates[0] || null
}

export function filenameForVideo(video, { includeIndex = false } = {}) {
  const rawTitle = video.title || video.id || 'x-video'
  const cleanedTitle = sanitize(rawTitle).replace(/\s+/g, ' ').trim().slice(0, 80)
  const title = cleanedTitle || 'x-video'
  const prefix = includeIndex ? `${String(video.index || 1).padStart(2, '0')}-` : ''
  return `${prefix}${title}.${normalizeExt(video.ext)}`
}

export function zipFilename(videos) {
  const first = videos[0] || {}
  const rawTitle = first.title || first.id || 'x-videos'
  const cleanedTitle = sanitize(rawTitle).replace(/\s+/g, ' ').trim().slice(0, 70)
  return `${cleanedTitle || 'x-videos'}-videos.zip`
}

export function collectVideoItems(info, { maxItems = 20, pageUrl = '' } = {}) {
  const videos = []
  const seenUrls = new Set()
  const rootTitle = info?.title || info?.fulltitle || info?.display_id || info?.id || 'x-video'

  for (const item of flattenEntries(info)) {
    if (videos.length >= maxItems) break

    const candidate = pickVideoCandidate(item)
    if (!candidate || seenUrls.has(candidate.url)) continue
    seenUrls.add(candidate.url)

    videos.push({
      ext: normalizeExt(candidate.ext || item.ext),
      height: candidate.height || item.height || null,
      id: item.id || item.display_id || '',
      index: videos.length + 1,
      pageUrl: item.webpage_url || info?.webpage_url || pageUrl,
      title: item.title || item.fulltitle || item.display_id || item.id || rootTitle,
      url: candidate.url,
      width: candidate.width || item.width || null,
    })
  }

  return videos
}

export async function extractXVideos(pageUrl, { maxItems = 20, timeoutMs = 30000 } = {}) {
  let info

  try {
    info = await youtubedl(pageUrl, {
      addHeader: [
        `referer:${pageUrl}`,
        `user-agent:${USER_AGENT}`,
      ],
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      playlistEnd: maxItems,
      skipDownload: true,
    }, {
      killSignal: 'SIGKILL',
      timeout: timeoutMs,
    })
  } catch (error) {
    console.warn('yt-dlp extraction failed', error)
    throw new DownloaderError(
      'extract_failed',
      'Could not read public X/Twitter media for that URL.',
      502,
    )
  }

  const videos = collectVideoItems(info, { maxItems, pageUrl })
  if (videos.length === 0) throw new NoVideosError()
  return videos
}
