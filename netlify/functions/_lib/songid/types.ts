// Provider-agnostic shapes: the frontend only ever sees these, never AudD
// field names, so the provider can be swapped without touching the UI.

export interface SongMatch {
  title: string
  artist: string
  album: string | null
  releaseDate: string | null
  coverArtUrl: string | null
  spotifyUrl: string | null
  appleMusicUrl: string | null
  /**
   * 0..1 when the provider reports one. AudD does not — any AudD result is a
   * confident match — so this stays null there; an ACRCloud adapter would
   * fill it.
   */
  confidence: number | null
}

export type IdentifyOutcome =
  | { status: 'match'; attemptsUsed: number; matchedFactor: number; result: SongMatch }
  | { status: 'no_match'; attemptsUsed: number }
