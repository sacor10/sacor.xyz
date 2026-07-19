// Client-side audio+video remuxing with ffmpeg.wasm.
//
// Facebook serves most reels/videos as DASH, where the audio and video live in
// separate fbcdn streams. When no muxed progressive MP4 exists, the downloader
// fetches both tracks and merges them here, in the browser, with a stream-copy
// remux (`-c copy` — no re-encode, so it's fast and lossless even on a phone).
//
// The lazy ffmpeg.wasm loader lives in ffmpeg.js (shared with song-id).
import { getFFmpeg } from './ffmpeg.js'

// Merge a separate video-only and audio-only stream into a single MP4 blob.
// `onStatus` (optional) receives short human-readable progress strings.
export async function muxVideoAudio(videoBlob, audioBlob, onStatus) {
  const { fetchFile } = await import('@ffmpeg/util')
  onStatus?.('loading merger')
  const ffmpeg = await getFFmpeg()

  // Capture ffmpeg's stderr so a failure reports *why* instead of a blank error.
  const logs = []
  const onLog = ({ message }) => {
    logs.push(message)
    if (logs.length > 60) logs.shift()
  }
  ffmpeg.on('log', onLog)

  try {
    onStatus?.('writing tracks')
    await ffmpeg.writeFile('in_v.mp4', await fetchFile(videoBlob))
    await ffmpeg.writeFile('in_a.mp4', await fetchFile(audioBlob))
    // -c copy: container-only remux, no transcoding. +faststart moves the moov
    // atom up front so the file plays/seeks immediately.
    onStatus?.('merging')
    const code = await ffmpeg.exec([
      '-i', 'in_v.mp4',
      '-i', 'in_a.mp4',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c', 'copy',
      '-movflags', '+faststart',
      'out.mp4',
    ])

    let data = null
    try {
      data = await ffmpeg.readFile('out.mp4')
    } catch {
      data = null
    }

    if (code !== 0 || !data || !data.length) {
      const tail = logs.filter(Boolean).slice(-8).join(' | ').slice(0, 500)
      throw new Error(`merge failed (code ${code}): ${tail || 'ffmpeg produced no output'}`)
    }

    return new Blob([data.buffer ?? data], { type: 'video/mp4' })
  } finally {
    if (typeof ffmpeg.off === 'function') ffmpeg.off('log', onLog)
    // Best-effort cleanup so a second merge in the same session starts clean.
    await Promise.all([
      ffmpeg.deleteFile('in_v.mp4').catch(() => {}),
      ffmpeg.deleteFile('in_a.mp4').catch(() => {}),
      ffmpeg.deleteFile('out.mp4').catch(() => {}),
    ])
  }
}
