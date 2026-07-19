// Regenerates the synthetic audio fixture used by the song-id tests.
// Checked-in output: tests/songid/fixtures/tone.wav — 20s mono 8kHz PCM,
// 8s of near-silence followed by 12s of a loud 440Hz tone, so the RMS window
// picker has an unambiguous right answer that is NOT t=0. Synthetic on
// purpose: no copyrighted audio belongs in the repo.
//
// Usage: node scripts/make-songid-fixtures.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'tests/songid/fixtures/tone.wav')

const SAMPLE_RATE = 8000
const QUIET_SECONDS = 8
const LOUD_SECONDS = 12

const total = (QUIET_SECONDS + LOUD_SECONDS) * SAMPLE_RATE
const samples = new Int16Array(total)
for (let i = 0; i < total; i++) {
  const t = i / SAMPLE_RATE
  if (t < QUIET_SECONDS) {
    // low-level noise, deterministic
    samples[i] = Math.round(200 * Math.sin(i * 12.9898) * Math.sin(i * 0.017))
  } else {
    samples[i] = Math.round(12000 * Math.sin(2 * Math.PI * 440 * t))
  }
}

const dataLength = samples.length * 2
const bytes = new Uint8Array(44 + dataLength)
const view = new DataView(bytes.buffer)
const ascii = (offset, text) => {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}
ascii(0, 'RIFF')
view.setUint32(4, 36 + dataLength, true)
ascii(8, 'WAVE')
ascii(12, 'fmt ')
view.setUint32(16, 16, true)
view.setUint16(20, 1, true)
view.setUint16(22, 1, true)
view.setUint32(24, SAMPLE_RATE, true)
view.setUint32(28, SAMPLE_RATE * 2, true)
view.setUint16(32, 2, true)
view.setUint16(34, 16, true)
ascii(36, 'data')
view.setUint32(40, dataLength, true)
new Uint8Array(bytes.buffer, 44).set(new Uint8Array(samples.buffer))

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, bytes)
console.log(`wrote ${outPath} (${bytes.length} bytes)`)
