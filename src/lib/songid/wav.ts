// Minimal RIFF/WAVE reader + writer for 16-bit PCM. Used in the browser to
// wrap the extracted clip, and in the song-identify function to validate the
// upload and to "resample" during the speed sweep (see withSampleRate).

export interface WavInfo {
  audioFormat: number
  channels: number
  sampleRate: number
  bitsPerSample: number
  dataOffset: number
  dataByteLength: number
  durationSeconds: number
}

const readAscii = (view: DataView, offset: number, length: number): string => {
  let out = ''
  for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i))
  return out
}

/**
 * Walks the RIFF chunk list (ffmpeg emits LIST/INFO chunks before `data`)
 * and returns format + data location, or null for anything malformed or
 * non-PCM. Never throws on hostile input.
 */
export function parseWav(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 44) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') return null

  let fmt: Omit<WavInfo, 'dataOffset' | 'dataByteLength' | 'durationSeconds'> | null = null
  let data: { offset: number; length: number } | null = null
  let pos = 12
  while (pos + 8 <= bytes.length) {
    const id = readAscii(view, pos, 4)
    const size = view.getUint32(pos + 4, true)
    const body = pos + 8
    if (body + size > bytes.length) return null
    if (id === 'fmt ') {
      if (size < 16) return null
      fmt = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      }
    } else if (id === 'data') {
      data = { offset: body, length: size }
    }
    pos = body + size + (size % 2) // chunks are word-aligned
  }

  if (!fmt || !data || fmt.audioFormat !== 1) return null
  if (fmt.channels < 1 || fmt.sampleRate < 8000 || fmt.bitsPerSample !== 16) return null
  const bytesPerSecond = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8)
  return {
    ...fmt,
    dataOffset: data.offset,
    dataByteLength: data.length,
    durationSeconds: data.length / bytesPerSecond,
  }
}

/** Int16 view of the PCM samples inside a parsed WAV. */
export function wavSamples(bytes: Uint8Array, info: WavInfo): Int16Array {
  return new Int16Array(bytes.buffer, bytes.byteOffset + info.dataOffset, info.dataByteLength / 2)
}

/** Wraps mono 16-bit samples in a canonical 44-byte-header WAV file. */
export function buildWav(samples: Int16Array, sampleRate: number): Uint8Array {
  const dataLength = samples.length * 2
  const bytes = new Uint8Array(44 + dataLength)
  const view = new DataView(bytes.buffer)
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, dataLength, true)
  new Uint8Array(bytes.buffer, 44).set(new Uint8Array(samples.buffer, samples.byteOffset, dataLength))
  return bytes
}

/**
 * Copy of a WAV with only the declared sample rate changed. Same samples
 * played at rate×factor shift pitch and tempo together — exactly ffmpeg's
 * `asetrate` — which is what undoes a slowed/sped-up edit. The recognition
 * provider resamples on ingest, so no DSP is needed here.
 */
export function withSampleRate(bytes: Uint8Array, info: WavInfo, newRate: number): Uint8Array {
  const out = bytes.slice()
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength)
  let pos = 12
  while (pos + 8 <= out.length) {
    const id = readAscii(view, pos, 4)
    const size = view.getUint32(pos + 4, true)
    if (id === 'fmt ') {
      const bytesPerFrame = info.channels * (info.bitsPerSample / 8)
      view.setUint32(pos + 8 + 4, newRate, true)
      view.setUint32(pos + 8 + 8, newRate * bytesPerFrame, true)
      return out
    }
    pos = pos + 8 + size + (size % 2)
  }
  return out
}
