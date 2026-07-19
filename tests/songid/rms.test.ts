import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pickBestWindow } from '../../src/lib/songid/rms'
import { parseWav, wavSamples } from '../../src/lib/songid/wav'

describe('pickBestWindow', () => {
  it('picks the loud section of the fixture, not t=0', () => {
    const bytes = new Uint8Array(readFileSync(join(__dirname, 'fixtures/tone.wav')))
    const info = parseWav(bytes)!
    const pick = pickBestWindow(wavSamples(bytes, info), info.sampleRate)
    // Fixture is 8s near-silence then 12s of loud tone at 8kHz.
    expect(pick.start).toBe(8 * 8000)
    expect(pick.length).toBe(12 * 8000)
  })

  it('returns the whole track when shorter than the window', () => {
    const pick = pickBestWindow(new Int16Array(8000 * 5), 8000)
    expect(pick).toEqual({ start: 0, length: 8000 * 5 })
  })

  it('prefers sustained music over a single loud transient', () => {
    const rate = 8000
    const samples = new Int16Array(rate * 30)
    // one very loud 1s spike at t=2
    for (let i = rate * 2; i < rate * 3; i++) samples[i] = 30000
    // moderate sustained tone from t=15 to t=30
    for (let i = rate * 15; i < rate * 30; i++) {
      samples[i] = Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / rate))
    }
    const pick = pickBestWindow(samples, rate)
    expect(pick.start).toBeGreaterThanOrEqual(rate * 14)
  })
})
