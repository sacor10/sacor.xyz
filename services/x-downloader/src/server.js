import express from 'express'
import { readConfig } from './config.js'
import { DownloaderError, NoVideosError } from './errors.js'
import { extractXVideos } from './extractor.js'
import { validateXUrl } from './x.js'
import { sendSingleVideo, sendZip } from './media.js'

function sendJsonError(res, error) {
  const status = error instanceof DownloaderError ? error.status : 500
  const code = error instanceof DownloaderError ? error.code : 'internal_error'
  const message = error instanceof DownloaderError
    ? error.message
    : 'The X/Twitter downloader failed unexpectedly.'

  res.status(status).json({ code, message })
}

function corsMiddleware(allowedOrigins) {
  const allowed = new Set(allowedOrigins)

  return (req, res, next) => {
    const origin = req.get('origin')

    if (origin) {
      if (!allowed.has(origin)) {
        sendJsonError(res, new DownloaderError('forbidden_origin', 'This origin is not allowed.', 403))
        return
      }

      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length')
      res.setHeader('Vary', 'Origin')
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }

    next()
  }
}

function jsonParseErrorHandler(error, _req, res, next) {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    sendJsonError(res, new DownloaderError('invalid_json', 'Request body must be valid JSON.', 400))
    return
  }
  next(error)
}

async function resolveVideos(extractVideos, href, config) {
  try {
    const videos = await extractVideos(href, {
      maxItems: config.maxItems,
      timeoutMs: config.extractTimeoutMs,
    })
    if (!Array.isArray(videos) || videos.length === 0) throw new NoVideosError()
    return videos.slice(0, config.maxItems)
  } catch (error) {
    if (error instanceof DownloaderError) throw error
    throw new DownloaderError(
      'extract_failed',
      'Could not read public X/Twitter media for that URL.',
      502,
    )
  }
}

export function createApp({
  config = readConfig(),
  extractVideos = extractXVideos,
  fetchImpl = fetch,
} = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(corsMiddleware(config.allowedOrigins))
  app.use(express.json({ limit: '8kb' }))
  app.use(jsonParseErrorHandler)

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true })
  })

  app.post('/download', async (req, res) => {
    try {
      const target = validateXUrl(req.body?.url)
      const videos = await resolveVideos(extractVideos, target.href, config)
      const streamOptions = {
        fetchImpl,
        maxBytes: config.maxVideoBytes,
        timeoutMs: config.mediaTimeoutMs,
      }

      if (videos.length === 1) {
        await sendSingleVideo(res, videos[0], streamOptions)
        return
      }

      await sendZip(res, videos, streamOptions)
    } catch (error) {
      if (res.headersSent) {
        console.error('download stream failed after headers were sent', error)
        res.destroy(error)
        return
      }
      sendJsonError(res, error)
    }
  })

  app.use((error, _req, res, _next) => {
    if (res.headersSent) {
      res.destroy(error)
      return
    }
    sendJsonError(res, error)
  })

  return app
}
