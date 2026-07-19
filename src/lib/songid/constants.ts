// Shared between the browser extractor and the song-identify Netlify function.
export const CLIP_SECONDS = 12
export const CLIP_SAMPLE_RATE = 44100
export const MAX_SOURCE_FILE_BYTES = 50 * 1024 * 1024
// 12s mono 16-bit 44.1kHz ≈ 1.06MB; headroom for header/chunk padding.
export const MAX_CLIP_BYTES = 1_500_000
