import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { collectVideoItems, filenameForVideo } from '../../services/youtube-downloader/src/extractor.js'
import { DownloaderError, NoVideosError } from '../../services/youtube-downloader/src/errors.js'
import { validateYouTubeUrl } from '../../services/youtube-downloader/src/youtube.js'

const EXTRACT_TIMEOUT_MS = 25000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const require = createRequire(import.meta.url)
const youtubedlPackage = require('youtube-dl-exec')
let cachedYtDlpPath = null

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

const errorBody = (code, message, status) => json({ code, message }, status)

function toJsonError(error) {
  if (error instanceof DownloaderError) {
    return errorBody(error.code, error.message, error.status)
  }
  return errorBody('internal_error', 'The YouTube downloader failed unexpectedly.', 500)
}

function findFile(startDir, filename, { maxDepth = 5 } = {}) {
  const seen = new Set()
  const walk = (dir, depth) => {
    if (!dir || depth > maxDepth || seen.has(dir)) return null
    seen.add(dir)

    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return null
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isFile() && entry.name === filename) return fullPath
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const found = walk(path.join(dir, entry.name), depth + 1)
      if (found) return found
    }

    return null
  }

  return walk(startDir, 0)
}

function resolveYtDlpPath() {
  if (cachedYtDlpPath && fs.existsSync(cachedYtDlpPath)) return cachedYtDlpPath

  const dirname = path.dirname(fileURLToPath(import.meta.url))
  const filenames = process.platform === 'win32'
    ? ['yt-dlp.exe']
    : ['yt-dlp_linux', 'yt-dlp']
  const packagedBinaryCandidates = process.platform === 'win32'
    ? []
    : [
        path.join(process.cwd(), 'netlify', 'bin', 'yt-dlp_linux'),
        path.join(dirname, 'netlify', 'bin', 'yt-dlp_linux'),
        path.join(dirname, '..', 'netlify', 'bin', 'yt-dlp_linux'),
        path.join(dirname, '..', '..', 'netlify', 'bin', 'yt-dlp_linux'),
        path.join('/var/task', 'netlify', 'bin', 'yt-dlp_linux'),
      ]
  const dependencyBinaryCandidates = [
    process.cwd(),
    dirname,
    path.join(dirname, '..'),
    path.join(dirname, '..', '..'),
    '/var/task',
    '/opt/nodejs',
  ].flatMap((base) => filenames.map((filename) =>
    path.join(base, 'node_modules', 'youtube-dl-exec', 'bin', filename),
  ))
  const candidates = [...packagedBinaryCandidates, ...dependencyBinaryCandidates]

  const direct = candidates.find((candidate) => fs.existsSync(candidate))
  const found = direct
    || filenames.map((filename) => findFile(dirname, filename)).find(Boolean)
    || filenames.map((filename) => findFile('/var/task', filename)).find(Boolean)
  if (!found) return null

  try {
    fs.chmodSync(found, 0o755)
  } catch (error) {
    console.error('[youtube-download] chmod failed', {
      path: found,
      message: error?.message,
      code: error?.code,
    })
  }

  cachedYtDlpPath = found
  return found
}

async function extractYouTubeVideos(pageUrl) {
  const binaryPath = resolveYtDlpPath()
  if (!binaryPath) {
    console.error('[youtube-download] missing yt-dlp binary', {
      cwd: process.cwd(),
      platform: process.platform,
    })
    throw new DownloaderError(
      'extract_failed',
      'Could not read public YouTube media for that URL. Diagnostic: missing yt-dlp binary.',
      502,
    )
  }

  const youtubedl = youtubedlPackage.create(binaryPath)
  let info

  try {
    info = await youtubedl(pageUrl, {
      addHeader: [
        `referer:${pageUrl}`,
        `user-agent:${USER_AGENT}`,
      ],
      dumpSingleJson: true,
      format: 'best[ext=mp4][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]/best[vcodec!=none]',
      noCheckCertificates: true,
      noPlaylist: true,
      noWarnings: true,
      playlistEnd: 1,
      skipDownload: true,
    }, {
      killSignal: 'SIGKILL',
      timeout: EXTRACT_TIMEOUT_MS,
    })
  } catch (error) {
    console.error('[youtube-download] yt-dlp extraction failed', {
      binaryPath,
      message: error?.message,
      stderr: error?.stderr,
      exitCode: error?.exitCode,
      code: error?.code,
    })
    const detail = error?.code || error?.exitCode || error?.message || 'yt-dlp failed'
    throw new DownloaderError(
      'extract_failed',
      `Could not read public YouTube media for that URL. Diagnostic: ${String(detail).slice(0, 160)}.`,
      502,
    )
  }

  const videos = collectVideoItems(info, { maxItems: 1, pageUrl })
  if (videos.length === 0) throw new NoVideosError()
  return videos
}

export default async (req) => {
  if (req.method !== 'POST') {
    return errorBody('method_not_allowed', 'Use POST.', 405)
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return errorBody('invalid_json', 'Request body must be valid JSON.', 400)
  }

  try {
    const target = validateYouTubeUrl(payload?.url)
    const videos = await extractYouTubeVideos(target.href)

    if (!Array.isArray(videos) || videos.length === 0) throw new NoVideosError()

    return json({
      videos: videos.slice(0, 1).map((video) => ({
        url: video.url,
        filename: filenameForVideo(video),
        width: video.width,
        height: video.height,
      })),
    })
  } catch (error) {
    return toJsonError(error)
  }
}
