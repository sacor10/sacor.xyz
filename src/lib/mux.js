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
const CORE_VERSION = '0.12.6'
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`

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
export async function muxVideoAudio(videoBlob, audioBlob) {
  const { fetchFile } = await import('@ffmpeg/util')
  const ffmpeg = await getFFmpeg()

  await ffmpeg.writeFile('in_v.mp4', await fetchFile(videoBlob))
  await ffmpeg.writeFile('in_a.mp4', await fetchFile(audioBlob))
  // -c copy: container-only remux, no transcoding. +faststart moves the moov
  // atom up front so the file plays/seeks immediately.
  await ffmpeg.exec([
    '-i', 'in_v.mp4',
    '-i', 'in_a.mp4',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c', 'copy',
    '-movflags', '+faststart',
    'out.mp4',
  ])
  const data = await ffmpeg.readFile('out.mp4')

  // Best-effort cleanup so a second merge in the same session starts clean.
  await Promise.all([
    ffmpeg.deleteFile('in_v.mp4').catch(() => {}),
    ffmpeg.deleteFile('in_a.mp4').catch(() => {}),
    ffmpeg.deleteFile('out.mp4').catch(() => {}),
  ])

  return new Blob([data.buffer ?? data], { type: 'video/mp4' })
}
