import type { SongMatch } from './types'

interface AuddEnrichment {
  spotify?: {
    external_urls?: { spotify?: string }
    album?: { images?: { url?: string }[] }
  }
  apple_music?: {
    url?: string
    artwork?: { url?: string }
  }
}

interface AuddResult extends AuddEnrichment {
  title?: string
  artist?: string
  album?: string
  release_date?: string
}

export class ProviderError extends Error {}

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

/** Apple artwork URLs are templates like ".../{w}x{h}bb.jpg". */
const appleArtwork = (url: string | null): string | null =>
  url ? url.replace('{w}', '500').replace('{h}', '500') : null

const coverArtFrom = (result: AuddResult): string | null =>
  str(result.spotify?.album?.images?.[0]?.url) ?? appleArtwork(str(result.apple_music?.artwork?.url))

/**
 * Maps an AudD /recognize payload to the normalized shape. Returns null for a
 * clean no-match; throws ProviderError when AudD reports an API error.
 */
export function normalizeAuddResponse(payload: unknown): SongMatch | null {
  const body = payload as { status?: string; error?: { error_code?: number; error_message?: string }; result?: AuddResult | null }
  if (!body || typeof body !== 'object') throw new ProviderError('Empty provider response')
  if (body.status === 'error') {
    const code = body.error?.error_code
    const message = body.error?.error_message || 'unknown provider error'
    throw new ProviderError(`AudD error${code ? ` #${code}` : ''}: ${message}`)
  }
  if (body.status !== 'success') throw new ProviderError('Unexpected provider response')

  const result = body.result
  if (!result || typeof result !== 'object') return null
  const title = str(result.title)
  const artist = str(result.artist)
  if (!title || !artist) return null

  return {
    title,
    artist,
    album: str(result.album),
    releaseDate: str(result.release_date),
    coverArtUrl: coverArtFrom(result),
    spotifyUrl: str(result.spotify?.external_urls?.spotify),
    appleMusicUrl: str(result.apple_music?.url),
    confidence: null,
  }
}
