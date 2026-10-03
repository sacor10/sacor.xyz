import express from 'express'
import { extractInfo, downloadStream, cleanFilename } from './downloader.js'

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8888',
  'http://127.0.0.1:8888',
  'http://localhost:8889',
  'http://127.0.0.1:8889',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://sacor.xyz',
  'https://www.sacor.xyz',
]

export function createApp() {
  const app = express()
  app.disable('x-powered-by')

  // CORS middleware
  app.use((req, res, next) => {
    const origin = req.get('origin')
    if (origin) {
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
  })

  app.use(express.json({ limit: '16kb' }))

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, service: 'youtube-downloader-api' })
  })

  // Inspect video formats
  app.post('/info', async (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : ''
    if (!url) {
      return res.status(400).json({ error: 'Please provide a valid YouTube URL.' })
    }

    try {
      const info = await extractInfo(url)
      res.json(info)
    } catch (err) {
      console.error('[youtube-downloader] Error inspecting:', err.message)
      res.status(500).json({ error: err.message || 'Failed to inspect YouTube video.' })
    }
  })

  // Stream video directly
  app.get('/stream', async (req, res) => {
    const url = typeof req.query?.url === 'string' ? req.query.url.trim() : ''
    const height = parseInt(req.query?.height, 10) || 2160
    const rawTitle = typeof req.query?.title === 'string' ? req.query.title.trim() : 'youtube-video'
    const safeTitle = cleanFilename(rawTitle)
    const filename = `${safeTitle}-${height}p.mp4`

    if (!url) {
      return res.status(400).json({ error: 'URL query parameter is required.' })
    }

    try {
      res.setHeader('Content-Type', 'video/mp4')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

      const proc = downloadStream(url, height)

      proc.stdout.pipe(res)

      proc.stderr.on('data', (d) => {
        // Log stderr for diagnostics if needed
      })

      req.on('close', () => {
        proc.kill()
      })

      proc.on('error', (err) => {
        console.error('[youtube-downloader] Process error:', err)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream extraction error' })
        }
      })
    } catch (err) {
      console.error('[youtube-downloader] Stream error:', err)
      if (!res.headersSent) {
        res.status(500).json({ error: err.message })
      }
    }
  })

  return app
}
