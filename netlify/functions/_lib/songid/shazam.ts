// Free recognition via the unofficial Shazam endpoint (amp.shazam.com), using
// the pure-JS `shazam-api` package: it builds the fingerprint signature itself
// (fft.js) and needs no account, token, or trial. Trade-off vs a paid API:
// it's unofficial, so it has no SLA and could break or start blocking
// datacenter IPs without notice — if that happens, switch SONG_ID_PROVIDER
// back to the AudD adapter.

import { Shazam } from 'shazam-api'
import { parseWav, wavSamples } from '../../../../src/lib/songid/wav'
import { ProviderError } from './normalize'
import type { RecognitionProvider, SongMatch } from './types'

/** Shazam signatures are generated from 16kHz mono s16 PCM. */
export const SHAZAM_SAMPLE_RATE = 16000

/**
 * Linear-interpolation resampler. Crude next to a windowed-sinc filter, but
 * fingerprinting only needs the spectral peaks to land in the right buckets,
 * and it keeps the function dependency-free. `fromRate` is the clip's
 * *declared* rate, so the sweep's asetrate header trick flows through here:
 * a clip relabeled 55125Hz comes out shorter and pitch-shifted, exactly as
 * if it were played back at 1.25x.
 */
export function resampleTo16k(samples: Int16Array, fromRate: number): number[] {
  const ratio = fromRate / SHAZAM_SAMPLE_RATE
  const outLength = Math.floor(samples.length / ratio)
  const out = new Array<number>(outLength)
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio
    const left = Math.floor(pos)
    const right = Math.min(left + 1, samples.length - 1)
    const frac = pos - left
    out[i] = Math.round(samples[left] * (1 - frac) + samples[right] * frac)
  }
  return out
}

// Shapes we actually read from the ShazamRoot response, all optional because
// the payload is undocumented and shifts over time.
interface ShazamTrackish {
  title?: string
  subtitle?: string
  images?: { coverart?: string; coverarthq?: string }
  hub?: {
    providers?: { type?: string; actions?: { uri?: string }[] }[]
    options?: { actions?: { uri?: string }[] }[]
  }
  sections?: { type?: string; metadata?: { title?: string; text?: string }[] }[]
  myshazam?: { apple?: { actions?: { uri?: string }[] } }
}

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const metadataText = (track: ShazamTrackish, key: string): string | null => {
  for (const section of track.sections ?? []) {
    for (const entry of section.metadata ?? []) {
      if (entry.title === key) return str(entry.text)
    }
  }
  return null
}

/** Shazam hands out `spotify:search:...` URIs; turn them into open.spotify.com links. */
const spotifyUrlFrom = (track: ShazamTrackish): string | null => {
  for (const provider of track.hub?.providers ?? []) {
    if (provider.type !== 'SPOTIFY') continue
    for (const action of provider.actions ?? []) {
      const uri = str(action.uri)
      if (!uri) continue
      if (uri.startsWith('https://')) return uri
      const search = uri.match(/^spotify:search:(.+)$/)
      if (search) return `https://open.spotify.com/search/${search[1]}`
    }
  }
  return null
}

const appleMusicUrlFrom = (track: ShazamTrackish): string | null => {
  for (const action of track.myshazam?.apple?.actions ?? []) {
    const uri = str(action.uri)
    if (uri?.startsWith('https://')) return uri
  }
  for (const option of track.hub?.options ?? []) {
    for (const action of option.actions ?? []) {
      const uri = str(action.uri)
      if (uri?.startsWith('https://music.apple.com')) return uri
    }
  }
  return null
}

/** Maps a ShazamRoot payload to the normalized shape; null for no track. */
export function normalizeShazamResponse(payload: unknown): SongMatch | null {
  const track = (payload as { track?: ShazamTrackish } | null)?.track
  if (!track || typeof track !== 'object') return null
  const title = str(track.title)
  const artist = str(track.subtitle)
  if (!title || !artist) return null
  return {
    title,
    artist,
    album: metadataText(track, 'Album'),
    releaseDate: metadataText(track, 'Released'),
    coverArtUrl: str(track.images?.coverarthq) ?? str(track.images?.coverart),
    spotifyUrl: spotifyUrlFrom(track),
    appleMusicUrl: appleMusicUrlFrom(track),
    confidence: null,
  }
}

export interface ShazamProviderOptions {
  timeoutMs?: number
}

export function createShazamProvider({ timeoutMs = 10000 }: ShazamProviderOptions = {}): RecognitionProvider {
  return {
    async recognize(clip) {
      const info = parseWav(clip)
      if (!info) throw new ProviderError('Clip is not a readable WAV')
      const samples = resampleTo16k(wavSamples(clip, info), info.sampleRate)

      // The library's fetch has no abort hook, so bound the wait instead.
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const result = await Promise.race([
          new Shazam().fullRecognizeSong(samples),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new ProviderError('Shazam request timed out')), timeoutMs)
          }),
        ])
        return normalizeShazamResponse(result)
      } catch (err) {
        if (err instanceof ProviderError) throw err
        throw new ProviderError(`Shazam request failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
