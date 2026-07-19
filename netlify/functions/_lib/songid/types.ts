// Provider-agnostic shapes: the frontend only ever sees these, never the
// provider's field names, so the provider can be swapped without touching the UI.

export interface SongMatch {
  title: string
  artist: string
  album: string | null
  releaseDate: string | null
  coverArtUrl: string | null
  spotifyUrl: string | null
  appleMusicUrl: string | null
  /**
   * 0..1 when the provider reports one. Shazam does not — any result it
   * returns is a confident match — so this stays null there; a provider
   * that scores matches (e.g. ACRCloud) would fill it.
   */
  confidence: number | null
}

export type IdentifyOutcome =
  | { status: 'match'; attemptsUsed: number; matchedFactor: number; result: SongMatch }
  | { status: 'no_match'; attemptsUsed: number }

export interface RecognitionProvider {
  /** Returns the match, or null when the provider is confident there is none. */
  recognize(clip: Uint8Array): Promise<SongMatch | null>
}
