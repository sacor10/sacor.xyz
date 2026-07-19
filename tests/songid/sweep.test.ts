import { describe, expect, it } from 'vitest'
import { runSpeedSweep, SWEEP_FACTORS } from '../../netlify/functions/_lib/songid/sweep'
import type { SongMatch } from '../../netlify/functions/_lib/songid/types'
import { buildWav, parseWav, wavSamples } from '../../src/lib/songid/wav'

const MATCH: SongMatch = {
  title: 'T',
  artist: 'A',
  album: null,
  releaseDate: null,
  coverArtUrl: null,
  spotifyUrl: null,
  appleMusicUrl: null,
  confidence: null,
}

const makeClip = () => {
  const clip = buildWav(Int16Array.from({ length: 44100 }, (_, i) => (i * 31) % 2048), 44100)
  return { clip, info: parseWav(clip)! }
}

/** Provider that "recognizes" the song only at one declared sample rate. */
const providerMatchingRate = (rate: number, seenRates: number[]) => ({
  async recognize(bytes: Uint8Array) {
    const info = parseWav(bytes)!
    seenRates.push(info.sampleRate)
    return info.sampleRate === rate ? MATCH : null
  },
})

const alwaysAllow = () => Promise.resolve(true)

describe('runSpeedSweep', () => {
  it('finds a slowed clip at 1.25x and short-circuits', () => {
    // A clip slowed to 0.8x speed matches when replayed at 44100*1.25=55125.
    const { clip, info } = makeClip()
    const seenRates: number[] = []
    return runSpeedSweep(clip, info, 4, {
      provider: providerMatchingRate(55125, seenRates),
      reserveCall: alwaysAllow,
    }).then(({ outcome, capExhausted }) => {
      expect(seenRates).toEqual([44100, 55125]) // stopped after the match
      expect(capExhausted).toBe(false)
      expect(outcome).toMatchObject({ status: 'match', attemptsUsed: 2, matchedFactor: 1.25, result: MATCH })
    })
  })

  it('tries factors in spec order and respects the attempt cap', async () => {
    const { clip, info } = makeClip()
    const seenRates: number[] = []
    const { outcome } = await runSpeedSweep(clip, info, 4, {
      provider: providerMatchingRate(-1, seenRates), // never matches
      reserveCall: alwaysAllow,
    })
    expect(seenRates).toEqual(
      SWEEP_FACTORS.slice(0, 4).map((f) => Math.round(44100 * f)),
    )
    expect(outcome).toEqual({ status: 'no_match', attemptsUsed: 4 })
  })

  it('does not mutate the sample data across attempts', async () => {
    const { clip, info } = makeClip()
    const original = Array.from(wavSamples(clip, info))
    const attempts: number[][] = []
    await runSpeedSweep(clip, info, 3, {
      provider: {
        async recognize(bytes: Uint8Array) {
          const i = parseWav(bytes)!
          attempts.push(Array.from(wavSamples(bytes, i)))
          return null
        },
      },
      reserveCall: alwaysAllow,
    })
    for (const attempt of attempts) expect(attempt).toEqual(original)
  })

  it('stops before the first call when the monthly cap is exhausted', async () => {
    const { clip, info } = makeClip()
    const seenRates: number[] = []
    const { outcome, capExhausted } = await runSpeedSweep(clip, info, 4, {
      provider: providerMatchingRate(44100, seenRates),
      reserveCall: () => Promise.resolve(false),
    })
    expect(seenRates).toEqual([])
    expect(capExhausted).toBe(true)
    expect(outcome).toEqual({ status: 'no_match', attemptsUsed: 0 })
  })

  it('stops mid-sweep when the cap runs out', async () => {
    const { clip, info } = makeClip()
    const seenRates: number[] = []
    let budget = 2
    const { outcome, capExhausted } = await runSpeedSweep(clip, info, 7, {
      provider: providerMatchingRate(-1, seenRates),
      reserveCall: () => Promise.resolve(budget-- > 0),
    })
    expect(seenRates).toHaveLength(2)
    expect(capExhausted).toBe(true)
    expect(outcome).toEqual({ status: 'no_match', attemptsUsed: 2 })
  })
})
