import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import yazl from 'yazl'
import { DownloaderError } from './errors.js'
import { filenameForVideo, zipFilename } from './extractor.js'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

function encodeRFC5987(value) {
  return encodeURIComponent(value)
    .replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, '%2A')
}

export function buildContentDisposition(filename) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeRFC5987(filename)}`
}

function createByteLimitStream(maxBytes) {
  let total = 0

  return new Transform({
    transform(chunk, _encoding, callback) {
      total += chunk.length
      if (Number.isFinite(maxBytes) && total > maxBytes) {
        callback(new DownloaderError('download_too_large', 'The X/Twitter video is too large to download.', 413))
        return
      }
      callback(null, chunk)
    },
  })
}

function contentLengthTooLarge(response, maxBytes) {
  const contentLength = Number(response.headers.get('content-length') || 0)
  return Number.isFinite(maxBytes) && contentLength > maxBytes
}

export async function fetchVideo(video, { fetchImpl = fetch, maxBytes, timeoutMs = 30000 } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(video.url, {
      headers: {
        Accept: '*/*',
        Referer: video.pageUrl || 'https://x.com/',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    })

    if (!response?.ok || !response.body) {
      throw new DownloaderError(
        'download_failed',
        'Could not fetch one or more X/Twitter video files.',
        502,
      )
    }

    if (contentLengthTooLarge(response, maxBytes)) {
      throw new DownloaderError('download_too_large', 'The X/Twitter video is too large to download.', 413)
    }

    return response
  } catch (error) {
    if (error instanceof DownloaderError) throw error
    throw new DownloaderError(
      'download_failed',
      'Could not fetch one or more X/Twitter video files.',
      502,
    )
  } finally {
    clearTimeout(timeout)
  }
}

function applyDownloadHeaders(res, { contentLength, contentType, filename }) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Disposition', buildContentDisposition(filename))
  res.setHeader('Content-Type', contentType)
  if (contentLength) res.setHeader('Content-Length', contentLength)
}

export async function sendSingleVideo(res, video, options = {}) {
  const response = await fetchVideo(video, options)
  const filename = filenameForVideo(video)

  applyDownloadHeaders(res, {
    contentLength: response.headers.get('content-length'),
    contentType: response.headers.get('content-type') || `video/${video.ext || 'mp4'}`,
    filename,
  })

  await pipeline(
    Readable.fromWeb(response.body),
    createByteLimitStream(options.maxBytes),
    res,
  )
}

export async function sendZip(res, videos, options = {}) {
  const fetched = []
  for (const video of videos) {
    fetched.push({ response: await fetchVideo(video, options), video })
  }

  const zip = new yazl.ZipFile()
  for (const { response, video } of fetched) {
    zip.addReadStream(
      Readable.fromWeb(response.body).pipe(createByteLimitStream(options.maxBytes)),
      filenameForVideo(video, { includeIndex: true }),
    )
  }
  zip.end()

  applyDownloadHeaders(res, {
    contentType: 'application/zip',
    filename: zipFilename(videos),
  })

  await pipeline(zip.outputStream, res)
}
