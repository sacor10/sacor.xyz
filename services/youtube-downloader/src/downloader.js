import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import sanitize from 'sanitize-filename'

const YTDLP_BIN = path.resolve(
  process.cwd(),
  'services/instagram-downloader/node_modules/youtube-dl-exec/bin/yt-dlp.exe'
)

export function cleanFilename(title, fallback = 'youtube-video') {
  const sanitized = sanitize(title || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return (sanitized || fallback).replace(/[^\w.\- ]+/g, '_')
}

export function extractInfo(url, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP_BIN, [
      '--dump-single-json',
      '--no-playlist',
      url,
    ])

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error('Timed out fetching video info.'))
    }, timeoutMs)

    proc.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    proc.stderr.on('data', (d) => {
      stderr += d.toString()
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        return reject(new Error(stderr || `yt-dlp failed with exit code ${code}`))
      }
      try {
        const raw = JSON.parse(stdout)
        const title = raw.title || 'YouTube Video'
        const safeTitle = cleanFilename(title)
        const thumbnail = raw.thumbnail || (raw.thumbnails && raw.thumbnails[raw.thumbnails.length - 1]?.url) || null
        const duration = raw.duration || 0

        // Filter and collect qualities
        const videoFormats = (raw.formats || []).filter(
          (f) => f.vcodec && f.vcodec !== 'none' && f.height
        )

        const qualityMap = new Map()
        for (const f of videoFormats) {
          const height = f.height
          if (!height) continue

          const label =
            height >= 2160
              ? '2160p (4K)'
              : height >= 1440
                ? '1440p (2K)'
                : height >= 1080
                  ? '1080p (Full HD)'
                  : height >= 720
                    ? '720p (HD)'
                    : `${height}p`

          if (!qualityMap.has(height)) {
            qualityMap.set(height, {
              height,
              label,
              fps: f.fps || 30,
              formatId: f.format_id,
              ext: 'mp4',
              vcodec: f.vcodec,
              filesize: f.filesize || f.filesize_approx || null,
              needsMux: true,
            })
          }
        }

        const qualities = Array.from(qualityMap.values()).sort((a, b) => b.height - a.height)

        resolve({
          id: raw.id,
          title,
          safeFilename: safeTitle,
          thumbnail,
          duration,
          qualities,
        })
      } catch (err) {
        reject(err)
      }
    })
  })
}

export function downloadStream(url, height = 2160) {
  // Best video stream matching requested height (preferring av01, mp4/h264, or vp9) + best AAC/m4a audio
  // merged into mp4 container and piped straight to stdout
  const formatSelector = `bestvideo[height<=${height}]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`

  const proc = spawn(YTDLP_BIN, [
    '-f', formatSelector,
    '--merge-output-format', 'mp4',
    '-o', '-',
    url,
  ])

  return proc
}
