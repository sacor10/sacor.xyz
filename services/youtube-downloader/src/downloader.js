import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import sanitize from 'sanitize-filename'
import { parallelDownload, muxCopy } from './fastDownload.js'

const YTDLP_BIN = path.resolve(
  process.cwd(),
  'services/instagram-downloader/node_modules/youtube-dl-exec/bin/yt-dlp.exe'
)

const DENO_BIN = path.resolve(
  process.env.LOCALAPPDATA || 'C:/Users/sacor.xyz/AppData/Local',
  'Microsoft/WinGet/Packages/DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe/deno.exe'
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
    const args = ['--dump-single-json', '--no-playlist']
    if (fs.existsSync(DENO_BIN)) {
      args.push('--js-runtimes', `deno:${DENO_BIN}`)
    }
    args.push(url)

    const proc = spawn(YTDLP_BIN, args)

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

export function downloadFile(url, height = 2160, customFilename = null) {
  const downloadDir = path.resolve(
    process.env.USERPROFILE || 'C:/Users/sacor.xyz',
    'Downloads'
  )
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true })
  }

  const baseName = customFilename || 'video'
  const finalPath = path.join(downloadDir, `${baseName}-${height}p.mp4`)
  const tempTemplate = path.join(downloadDir, `${baseName}-${height}p.%(ext)s`)

  const formatSelector = `bestvideo[height<=${height}][vcodec^=av01]+bestaudio[ext=m4a]/bestvideo[height<=${height}][vcodec^=avc1]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`

  return new Promise((resolve, reject) => {
    const args = [
      '-f', formatSelector,
      '--concurrent-fragments', '16',
      '--http-chunk-size', '10M',
      '--buffer-size', '16M',
      '--no-part',
      '--retries', '10',
      '--fragment-retries', '10',
      '--socket-timeout', '15',
      '--merge-output-format', 'mp4',
      '--postprocessor-args', 'Merger:-movflags +faststart',
      '-o', tempTemplate,
      '--no-playlist',
    ]

    if (fs.existsSync(DENO_BIN)) {
      args.push('--js-runtimes', `deno:${DENO_BIN}`)
    }
    args.push(url)

    const proc = spawn(YTDLP_BIN, args)

    let stderr = ''
    proc.stderr.on('data', (d) => {
      stderr += d.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || `yt-dlp exited with code ${code}`))
      }
      if (fs.existsSync(finalPath)) {
        const stats = fs.statSync(finalPath)
        resolve({ path: finalPath, size: stats.size, filename: path.basename(finalPath) })
      } else {
        // Find any created mp4 matching baseName
        const files = fs.readdirSync(downloadDir)
        const matched = files.find((f) => f.includes(baseName) && f.endsWith('.mp4'))
        if (matched) {
          const matchedPath = path.join(downloadDir, matched)
          resolve({ path: matchedPath, size: fs.statSync(matchedPath).size, filename: matched })
        } else {
          reject(new Error('Downloaded file not found after merge.'))
        }
      }
    })

    proc.on('error', reject)
  })
}

/**
 * Get full raw format data from yt-dlp including stream URLs and http_headers.
 * This is separate from extractInfo() because extractInfo strips out URLs for security.
 */
export function extractRawFormats(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const args = ['--dump-single-json', '--no-playlist']
    if (fs.existsSync(DENO_BIN)) {
      args.push('--js-runtimes', `deno:${DENO_BIN}`)
    }
    args.push(url)

    const proc = spawn(YTDLP_BIN, args)
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error('Timed out fetching raw format data.'))
    }, timeoutMs)

    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) return reject(new Error(stderr || `yt-dlp exit ${code}`))
      try {
        resolve(JSON.parse(stdout))
      } catch (err) {
        reject(err)
      }
    })
  })
}

/**
 * Fast parallel download: fetches video+audio streams concurrently using
 * byte-range requests (24 connections per stream), then muxes with ffmpeg.
 * Falls back to regular downloadFile() on any failure.
 */
export async function fastDownloadFile(url, height = 2160, customFilename = null, onProgress = null) {
  const downloadDir = path.resolve(
    process.env.USERPROFILE || os.homedir(),
    'Downloads'
  )
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true })
  }

  const baseName = customFilename || 'video'
  const finalPath = path.join(downloadDir, `${baseName}-${height}p.mp4`)

  // Temp files for the parallel download
  const tmpDir = path.join(os.tmpdir(), 'yt-fast-dl')
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
  const videoTmp = path.join(tmpDir, `${baseName}-${height}p-video.tmp`)
  const audioTmp = path.join(tmpDir, `${baseName}-${height}p-audio.tmp`)

  try {
    onProgress?.({ stage: 'inspecting', percent: 5, message: 'Extracting video and audio streams...' })
    console.log('[fast-dl] Extracting format URLs...')
    const raw = await extractRawFormats(url)
    const formats = raw.formats || []

    // Pick best video format at requested height
    const videoFmts = formats
      .filter((f) => f.vcodec && f.vcodec !== 'none' && f.height && f.height <= height && f.url)
      .sort((a, b) => {
        // Prefer av01 (native mp4) > avc1 > vp9, then by height desc, then tbr desc
        const codecPrio = (c) => c.startsWith('av01') ? 3 : c.startsWith('avc1') ? 2 : 1
        const cp = codecPrio(b.vcodec) - codecPrio(a.vcodec)
        if (cp !== 0) return cp
        if (b.height !== a.height) return b.height - a.height
        return (b.tbr || 0) - (a.tbr || 0)
      })

    // Pick best audio format
    const audioFmts = formats
      .filter((f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none') && f.url)
      .sort((a, b) => {
        // Prefer m4a/mp4 audio (no remux needed), then by bitrate
        const extPrio = (e) => (e === 'm4a' || e === 'mp4') ? 2 : 1
        const ep = extPrio(b.ext) - extPrio(a.ext)
        if (ep !== 0) return ep
        return (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0)
      })

    if (!videoFmts.length || !audioFmts.length) {
      console.log('[fast-dl] No suitable separate streams found, falling back to yt-dlp...')
      return downloadFile(url, height, customFilename)
    }

    const videoFmt = videoFmts[0]
    const audioFmt = audioFmts[0]

    console.log(`[fast-dl] Video: ${videoFmt.format_id} (${videoFmt.height}p ${videoFmt.vcodec}) ~${Math.round((videoFmt.filesize || videoFmt.filesize_approx || 0) / 1024 / 1024)}MB`)
    console.log(`[fast-dl] Audio: ${audioFmt.format_id} (${audioFmt.acodec}) ~${Math.round((audioFmt.filesize || audioFmt.filesize_approx || 0) / 1024 / 1024)}MB`)

    let videoDone = 0
    let videoTotal = videoFmt.filesize || videoFmt.filesize_approx || 0
    let audioDone = 0
    let audioTotal = audioFmt.filesize || audioFmt.filesize_approx || 0

    const reportProgress = () => {
      const combinedDone = videoDone + audioDone
      const combinedTotal = (videoTotal || 1) + (audioTotal || 1)
      const pct = Math.min(90, Math.max(10, Math.round(10 + (combinedDone / combinedTotal) * 80)))
      const mbDone = (combinedDone / 1024 / 1024).toFixed(1)
      const mbTotal = (combinedTotal / 1024 / 1024).toFixed(1)
      onProgress?.({
        stage: 'downloading',
        percent: pct,
        downloadedBytes: combinedDone,
        totalBytes: combinedTotal,
        message: `Downloading video + audio in parallel (${mbDone} / ${mbTotal} MB)...`
      })
    }

    // Download both streams in parallel
    const startTime = Date.now()
    const [videoSize, audioSize] = await Promise.all([
      parallelDownload(videoFmt, videoTmp, (done, total) => {
        videoDone = done
        if (total) videoTotal = total
        reportProgress()
      }),
      parallelDownload(audioFmt, audioTmp, (done, total) => {
        audioDone = done
        if (total) audioTotal = total
        reportProgress()
      }),
    ])

    const dlElapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const totalMB = ((videoSize + audioSize) / 1024 / 1024).toFixed(1)
    console.log(`[fast-dl] Downloaded ${totalMB} MB in ${dlElapsed}s (${(totalMB / dlElapsed).toFixed(1)} MB/s)`)

    // Mux with ffmpeg stream-copy
    console.log('[fast-dl] Muxing video + audio...')
    onProgress?.({ stage: 'muxing', percent: 93, message: 'Losslessly muxing video & audio with FFmpeg...' })
    await muxCopy(videoTmp, audioTmp, finalPath)
    console.log(`[fast-dl] Done: ${finalPath}`)

    // Cleanup temp files
    try { fs.unlinkSync(videoTmp) } catch {}
    try { fs.unlinkSync(audioTmp) } catch {}

    const stats = fs.statSync(finalPath)
    onProgress?.({ stage: 'completed', percent: 100, message: 'Complete!' })
    return { path: finalPath, size: stats.size, filename: path.basename(finalPath) }
  } catch (err) {
    console.error('[fast-dl] Parallel download failed, falling back to yt-dlp:', err.message)
    // Cleanup temp files on failure
    try { fs.unlinkSync(videoTmp) } catch {}
    try { fs.unlinkSync(audioTmp) } catch {}
    return downloadFile(url, height, customFilename)
  }
}
