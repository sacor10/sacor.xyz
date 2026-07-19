import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildWav, parseWav, wavSamples, withSampleRate } from '../../src/lib/songid/wav'

const fixture = () => new Uint8Array(readFileSync(join(__dirname, 'fixtures/tone.wav')))

describe('parseWav / buildWav', () => {
  it('round-trips samples through build and parse', () => {
    const samples = Int16Array.from([0, 1000, -1000, 32767, -32768, 42])
    const wav = buildWav(samples, 44100)
    const info = parseWav(wav)
    expect(info).not.toBeNull()
    expect(info!.sampleRate).toBe(44100)
    expect(info!.channels).toBe(1)
    expect(info!.bitsPerSample).toBe(16)
    expect(Array.from(wavSamples(wav, info!))).toEqual(Array.from(samples))
  })

  it('computes duration from the data chunk', () => {
    const samples = new Int16Array(44100 * 3)
    const info = parseWav(buildWav(samples, 44100))
    expect(info!.durationSeconds).toBeCloseTo(3, 5)
  })

  it('parses the checked-in fixture clip', () => {
    const info = parseWav(fixture())
    expect(info).not.toBeNull()
    expect(info!.sampleRate).toBe(8000)
    expect(info!.durationSeconds).toBeCloseTo(20, 3)
  })

  it('rejects non-WAV bytes', () => {
    expect(parseWav(new Uint8Array(100))).toBeNull()
    expect(parseWav(new TextEncoder().encode('RIFFxxxxNOPE' + 'x'.repeat(60)))).toBeNull()
  })

  it('rejects truncated files and non-PCM formats', () => {
    const wav = buildWav(new Int16Array(100), 44100)
    expect(parseWav(wav.slice(0, 30))).toBeNull()
    const floatWav = wav.slice()
    new DataView(floatWav.buffer).setUint16(20, 3, true) // IEEE float format tag
    expect(parseWav(floatWav)).toBeNull()
  })
})

describe('withSampleRate', () => {
  it('rewrites only the declared rate, leaving samples untouched', () => {
    const samples = Int16Array.from({ length: 500 }, (_, i) => (i * 37) % 4096)
    const wav = buildWav(samples, 44100)
    const info = parseWav(wav)!
    const shifted = withSampleRate(wav, info, 55125)
    const shiftedInfo = parseWav(shifted)
    expect(shiftedInfo!.sampleRate).toBe(55125)
    expect(Array.from(wavSamples(shifted, shiftedInfo!))).toEqual(Array.from(samples))
    // original is not mutated
    expect(parseWav(wav)!.sampleRate).toBe(44100)
  })

  it('shortens declared duration when the rate goes up (asetrate semantics)', () => {
    const wav = buildWav(new Int16Array(44100 * 12), 44100)
    const info = parseWav(wav)!
    const sped = parseWav(withSampleRate(wav, info, Math.round(44100 * 1.25)))!
    expect(sped.durationSeconds).toBeCloseTo(12 / 1.25, 2)
  })
})
