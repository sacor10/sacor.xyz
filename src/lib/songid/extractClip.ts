// Browser-side clip extraction: decode any supported container's audio track
// with ffmpeg.wasm, pick the most music-dense 12s, and re-wrap it as a small
// mono WAV. Only that WAV ever leaves the browser.

import { getFFmpeg } from '../ffmpeg.js'
import { CLIP_SAMPLE_RATE, CLIP_SECONDS } from './constants'
import { pickBestWindow } from './rms'
import { buildWav, parseWav, wavSamples } from './wav'

export type ExtractStage = 'decoding' | 'extracting'

export async function extractAnalysisClip(
  file: File,
  onStage?: (stage: ExtractStage) => void,
): Promise<Uint8Array> {
  onStage?.('decoding')
  const ffmpeg = await getFFmpeg()
  const input = 'songid-in'
  const output = 'songid-out.wav'
  try {
    await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()))
    const code = await ffmpeg.exec([
      '-i', input,
      '-vn',
      '-ac', '1',
      '-ar', String(CLIP_SAMPLE_RATE),
      '-f', 'wav',
      output,
    ])
    let decoded: Uint8Array | null = null
    if (code === 0) {
      try {
        const data = await ffmpeg.readFile(output)
        decoded = typeof data === 'string' ? null : data
      } catch {
        decoded = null
      }
    }
    if (!decoded || !decoded.length) {
      throw new Error('Could not decode an audio track from this file.')
    }

    onStage?.('extracting')
    const info = parseWav(decoded)
    if (!info) throw new Error('Decoded audio was not readable.')
    const samples = wavSamples(decoded, info)
    const window = pickBestWindow(samples, info.sampleRate, CLIP_SECONDS)
    const clip = samples.slice(window.start, window.start + window.length)
    return buildWav(clip, info.sampleRate)
  } finally {
    await Promise.all([
      ffmpeg.deleteFile(input).catch(() => {}),
      ffmpeg.deleteFile(output).catch(() => {}),
    ])
  }
}
