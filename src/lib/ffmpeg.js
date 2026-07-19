// Shared lazy loader for ffmpeg.wasm, used by mux.js (Facebook DASH remux)
// and the song-id clip extractor.
//
// The ffmpeg core wasm (~30 MB) is loaded lazily from a CDN the first time it
// is needed, so it never bloats the initial page load. We use the
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

export async function getFFmpeg() {
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
