// Client-side audio+video remuxing with ffmpeg.wasm.
//
// Facebook serves most reels/videos as DASH, where the audio and video live in
// separate fbcdn streams. When no muxed progressive MP4 exists, the downloader
// fetches both tracks and merges them here, in the browser, with a stream-copy
// remux (`-c copy` — no re-encode, so it's fast and lossless even on a phone).
//
// The ffmpeg core wasm (~30 MB) is loaded lazily from a CDN the first time a
// merge is needed, so it never bloats the initial page load. We use the
// single-threaded core, which does not require SharedArrayBuffer / cross-origin
// isolation, so the site's existing COOP headers are left untouched.
//
// @ffmpeg/ffmpeg 0.12 runs a *module* worker, where importScripts is
// unavailable, so the worker loads the core via `await import(coreURL)`. That
// requires the ESM build of the core (the UMD build has no default export and
// fails with "failed to import ffmpeg-core.js"). CORE_VERSION must match the
// CORE_VERSION baked into the installed @ffmpeg/ffmpeg.
const CORE_VERSION = '0.12.9'
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`

let ffmpegPromise = null

async function getFFmpeg() {
  if (ffmpegPromise) return ffmpegPromise
  ffmpegPromise = (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util'),
    ])
    const ffmpeg = new FFmpeg()
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    return ffmpeg
  })().catch((err) => {
    // Reset so a later attempt can retry the load instead of reusing a reject.
    ffmpegPromise = null
    throw err
  })
  return ffmpegPromise
}

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
