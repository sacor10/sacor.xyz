import express from 'express'
import fs from 'node:fs'
import { extractInfo, downloadFile, cleanFilename } from './downloader.js'

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

  // Stream video directly to browser download
  app.get('/stream', async (req, res) => {
    const url = typeof req.query?.url === 'string' ? req.query.url.trim() : ''
    const height = parseInt(req.query?.height, 10) || 720
    const rawTitle = typeof req.query?.title === 'string' ? req.query.title.trim() : 'youtube-video'
    const safeTitle = cleanFilename(rawTitle)

    if (!url) {
      return res.status(400).json({ error: 'URL query parameter is required.' })
    }

    try {
      const result = await downloadFile(url, height, safeTitle)
      res.setHeader('Content-Type', 'video/mp4')
      res.setHeader('Content-Length', result.size)
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)

      const stream = fs.createReadStream(result.path)
      stream.pipe(res)
    } catch (err) {
      console.error('[youtube-downloader] Stream error:', err.message)
      if (!res.headersSent) {
        res.status(500).json({ error: err.message })
      }
    }
  })

  // Direct download endpoint - downloads once directly to user's Downloads folder
  app.post('/download', async (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : ''
    const height = parseInt(req.body?.height, 10) || 720
    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : 'video'
    const safeTitle = cleanFilename(rawTitle)

    if (!url) {
      return res.status(400).json({ error: 'Please provide a valid YouTube URL.' })
    }

    try {
      console.log(`[youtube-downloader] Downloading ${safeTitle} (${height}p) directly to Downloads...`)
      const result = await downloadFile(url, height, safeTitle)
      console.log(`[youtube-downloader] Download finished: ${result.path} (${result.size} bytes)`)
      res.json({ ok: true, ...result })
    } catch (err) {
      console.error('[youtube-downloader] Download failed:', err.message)
      res.status(500).json({ error: err.message })
    }
  })

  return app
}
