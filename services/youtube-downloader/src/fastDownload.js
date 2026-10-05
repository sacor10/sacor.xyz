import fs from 'node:fs'
import { spawn } from 'node:child_process'

const CHUNK_SIZE = 8 * 1024 * 1024 // 8 MB ranges stay under YouTube's per-request throttle threshold
const CONNECTIONS = 24 // concurrent range requests per stream

async function fetchRange(url, headers, start, end, attempt = 0) {
  try {
    const res = await fetch(url, { headers: { ...headers, Range: `bytes=${start}-${end}` } })
    if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    if (attempt >= 5) throw err
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
    return fetchRange(url, headers, start, end, attempt + 1)
  }
}

async function getContentLength(fmt) {
  if (fmt.filesize) return fmt.filesize
  const m = /[?&]clen=(\d+)/.exec(fmt.url)
  if (m) return Number(m[1])
  const res = await fetch(fmt.url, { method: 'HEAD', headers: fmt.http_headers || {} })
  const len = Number(res.headers.get('content-length'))
  if (!len) throw new Error('Unknown content length')
  return len
}

export async function parallelDownload(fmt, outPath, onProgress) {
  const total = await getContentLength(fmt)
  const headers = fmt.http_headers || {}
  const fd = await fs.promises.open(outPath, 'w')
  await fd.truncate(total)

  const ranges = []
  for (let s = 0; s < total; s += CHUNK_SIZE) ranges.push([s, Math.min(s + CHUNK_SIZE - 1, total - 1)])

  let next = 0
  let done = 0
  const worker = async () => {
    while (next < ranges.length) {
      const idx = next++
      const [start, end] = ranges[idx]
      const buf = await fetchRange(fmt.url, headers, start, end)
      await fd.write(buf, 0, buf.length, start)
      done += buf.length
      onProgress?.(done, total)
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(CONNECTIONS, ranges.length) }, worker))
  } finally {
    await fd.close()
  }
  return total
}

export function muxCopy(videoPath, audioPath, outPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', videoPath, '-i', audioPath,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c', 'copy', '-movflags', '+faststart',
      outPath,
    ])
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr += d })
    proc.on('error', reject)
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg exit ${code}`))))
  })
}

export function convertToMp3(audioPath, outPath, bitrate = '320k') {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', audioPath,
      '-vn',
      '-c:a', 'libmp3lame',
      '-b:a', bitrate,
      outPath,
    ])
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr += d })
    proc.on('error', reject)
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg exit ${code}`))))
  })
}
