import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  normalizeShazamResponse,
  resampleTo16k,
  SHAZAM_SAMPLE_RATE,
} from '../../netlify/functions/_lib/songid/shazam'

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'))

describe('normalizeShazamResponse', () => {
  it('maps a full Shazam match to the normalized shape', () => {
    expect(normalizeShazamResponse(fixture('shazam-match.json'))).toEqual({
      title: 'Warriors',
      artist: 'Imagine Dragons',
      album: 'Warriors',
      releaseDate: '2014',
      coverArtUrl: 'https://is4-ssl.mzstatic.com/image/thumb/1000x1000cc.jpg',
      spotifyUrl: 'https://open.spotify.com/search/Warriors%20Imagine%20Dragons',
      appleMusicUrl:
        'https://music.apple.com/us/album/warriors/1440831203?i=1440831624&mt=1&app=music&itsct=Shazam_1',
      confidence: null,
    })
  })

  it('degrades gracefully when enrichment blocks are missing', () => {
    const payload = fixture('shazam-match.json') as { track: Record<string, unknown> }
    delete payload.track.hub
    delete payload.track.myshazam
    delete payload.track.sections
    delete payload.track.images
    const match = normalizeShazamResponse(payload)
    expect(match).toEqual({
      title: 'Warriors',
      artist: 'Imagine Dragons',
      album: null,
      releaseDate: null,
      coverArtUrl: null,
      spotifyUrl: null,
      appleMusicUrl: null,
      confidence: null,
    })
  })

  it('returns null for no-track payloads and garbage', () => {
    expect(normalizeShazamResponse(fixture('shazam-no-match.json'))).toBeNull()
    expect(normalizeShazamResponse(null)).toBeNull()
    expect(normalizeShazamResponse({ track: { title: 'Only Title' } })).toBeNull()
  })
})

describe('resampleTo16k', () => {
  it('is the identity at 16kHz', () => {
    const samples = Int16Array.from([0, 100, -100, 32767, -32768])
    expect(resampleTo16k(samples, SHAZAM_SAMPLE_RATE)).toEqual([0, 100, -100, 32767, -32768])
  })

  it('halves the sample count from 32kHz and interpolates between points', () => {
    const samples = Int16Array.from({ length: 3200 }, (_, i) => i % 2 === 0 ? 0 : 1000)
    const out = resampleTo16k(samples, 32000)
    expect(out).toHaveLength(1600)
    expect(out[1]).toBe(0) // lands exactly on an even (0-valued) input sample
  })

  it('honors the declared rate, so the asetrate sweep shortens the output', () => {
    const samples = new Int16Array(44100) // 1s at true 44.1kHz
    const normal = resampleTo16k(samples, 44100)
    const spedUp = resampleTo16k(samples, Math.round(44100 * 1.25))
    expect(normal).toHaveLength(16000)
    expect(spedUp.length).toBeLessThan(normal.length)
    expect(spedUp.length / normal.length).toBeCloseTo(1 / 1.25, 2)
  })
})
