import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeAuddResponse, ProviderError } from '../../netlify/functions/_lib/songid/normalize'

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'))

describe('normalizeAuddResponse', () => {
  it('maps a full AudD match to the normalized shape', () => {
    const match = normalizeAuddResponse(fixture('audd-match.json'))
    expect(match).toEqual({
      title: 'Warriors',
      artist: 'Imagine Dragons',
      album: 'Warriors',
      releaseDate: '2014-09-18',
      coverArtUrl: 'https://i.scdn.co/image/ab67616d0000b273b2bec6f5cee278e04dcc78ff',
      spotifyUrl: 'https://open.spotify.com/track/1lgN0A2Vki2FTON5PYq42m',
      appleMusicUrl: 'https://music.apple.com/us/album/warriors/1440831203?i=1440831624',
      confidence: null,
    })
  })

  it('falls back to Apple artwork (with size template filled) when Spotify is absent', () => {
    const payload = fixture('audd-match.json') as { result: Record<string, unknown> }
    delete payload.result.spotify
    const match = normalizeAuddResponse(payload)
    expect(match!.coverArtUrl).toBe(
      'https://is4-ssl.mzstatic.com/image/thumb/Music118/v4/26/c8/4f/26c84f48-4d97-2b3c-a8ff-b6f0e9dbeb2f/source/500x500bb.jpg',
    )
    expect(match!.spotifyUrl).toBeNull()
  })

  it('handles a minimal match with no enrichment blocks', () => {
    const match = normalizeAuddResponse(fixture('audd-match-minimal.json'))
    expect(match).toEqual({
      title: 'Obscure Song',
      artist: 'Some Artist',
      album: null,
      releaseDate: null,
      coverArtUrl: null,
      spotifyUrl: null,
      appleMusicUrl: null,
      confidence: null,
    })
  })

  it('returns null for a clean no-match', () => {
    expect(normalizeAuddResponse(fixture('audd-no-match.json'))).toBeNull()
  })

  it('throws ProviderError for AudD error payloads and garbage', () => {
    expect(() => normalizeAuddResponse(fixture('audd-error.json'))).toThrow(ProviderError)
    expect(() => normalizeAuddResponse(fixture('audd-error.json'))).toThrow(/901/)
    expect(() => normalizeAuddResponse(null)).toThrow(ProviderError)
    expect(() => normalizeAuddResponse({ status: 'weird' })).toThrow(ProviderError)
  })
})
