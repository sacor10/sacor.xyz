import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { extractInfo, downloadFile, fastDownloadFile, downloadMp3, fastDownloadMp3, cleanFilename } from './downloader.js'

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

  // Streaming download endpoint with realtime progress updates via NDJSON / SSE
  app.post('/download-stream', async (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : ''
    const format = req.body?.format === 'mp3' ? 'mp3' : 'mp4'
    const height = parseInt(req.body?.height, 10) || 720
    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : (format === 'mp3' ? 'audio' : 'video')
    const safeTitle = cleanFilename(rawTitle)

    if (!url) {
      return res.status(400).json({ error: 'Please provide a valid YouTube URL.' })
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const sendProgress = (data) => {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      } catch {}
    }

    sendProgress({ stage: 'start', percent: 2, message: format === 'mp3' ? 'Initiating MP3 download...' : 'Initiating download...' })

    try {
      let lastReport = 0
      const onProgress = (prog) => {
        const now = Date.now()
        if (now - lastReport > 150 || prog.stage !== 'downloading' || prog.percent === 100) {
          lastReport = now
          sendProgress(prog)
        }
      }

      console.log(`[youtube-downloader] STREAM download ${safeTitle} (${format === 'mp3' ? 'MP3' : `${height}p`})...`)
      let result
      if (format === 'mp3') {
        result = await fastDownloadMp3(url, safeTitle, onProgress)
      } else {
        result = await fastDownloadFile(url, height, safeTitle, onProgress)
      }
      
      sendProgress({
        stage: 'completed',
        percent: 100,
        message: 'Download complete!',
        result: {
          path: result.path,
          size: result.size,
          filename: result.filename,
          downloadUrl: `/file?name=${encodeURIComponent(result.filename)}`
        }
      })
      res.end()
    } catch (err) {
      console.error('[youtube-downloader] Stream download failed:', err.message)
      sendProgress({ stage: 'error', error: err.message })
      res.end()
    }
  })

  // Serve completed file to trigger Chrome downloads tray & notification
  app.get('/file', (req, res) => {
    const filename = typeof req.query?.name === 'string' ? path.basename(req.query.name) : ''
    if (!filename) {
      return res.status(400).send('Filename missing')
    }

    const tmpPath = path.join(os.tmpdir(), 'yt-fast-dl', filename)
    const downloadDir = path.resolve(
      process.env.USERPROFILE || 'C:/Users/sacor.xyz',
      'Downloads'
    )
    const dlPath = path.join(downloadDir, filename)

    const filePath = fs.existsSync(tmpPath) ? tmpPath : (fs.existsSync(dlPath) ? dlPath : null)
    if (!filePath) {
      return res.status(404).send('File not found')
    }

    const stat = fs.statSync(filePath)
    const isMp3 = filename.endsWith('.mp3')
    res.setHeader('Content-Type', isMp3 ? 'audio/mpeg' : 'video/mp4')
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    const stream = fs.createReadStream(filePath)
    stream.pipe(res)
  })

  // Direct download endpoint - downloads once directly to user's Downloads folder
  app.post('/download', async (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : ''
    const format = req.body?.format === 'mp3' ? 'mp3' : 'mp4'
    const height = parseInt(req.body?.height, 10) || 720
    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : (format === 'mp3' ? 'audio' : 'video')
    const safeTitle = cleanFilename(rawTitle)
    const useFast = req.body?.fast !== false // default to fast parallel download

    if (!url) {
      return res.status(400).json({ error: 'Please provide a valid YouTube URL.' })
    }

    try {
      let result
      if (format === 'mp3') {
        const mp3Downloader = useFast ? fastDownloadMp3 : downloadMp3
        console.log(`[youtube-downloader] ${useFast ? 'FAST' : 'Standard'} downloading MP3 ${safeTitle}...`)
        result = await mp3Downloader(url, safeTitle)
      } else {
        const downloader = useFast ? fastDownloadFile : downloadFile
        console.log(`[youtube-downloader] ${useFast ? 'FAST' : 'Standard'} downloading ${safeTitle} (${height}p) to Downloads...`)
        result = await downloader(url, height, safeTitle)
      }
      console.log(`[youtube-downloader] Download finished: ${result.path} (${result.size} bytes)`)
      res.json({ ok: true, ...result })
    } catch (err) {
      console.error('[youtube-downloader] Download failed:', err.message)
      res.status(500).json({ error: err.message })
    }
  })

  return app
}
