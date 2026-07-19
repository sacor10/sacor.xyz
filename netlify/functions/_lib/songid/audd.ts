import { normalizeAuddResponse, ProviderError } from './normalize'
import type { RecognitionProvider } from './types'

const AUDD_ENDPOINT = 'https://api.audd.io/'

export interface AuddProviderOptions {
  token: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export function createAuddProvider({
  token,
  timeoutMs = 8000,
  fetchImpl = fetch,
}: AuddProviderOptions): RecognitionProvider {
  return {
    async recognize(clip) {
      const form = new FormData()
      form.set('api_token', token)
      form.set('return', 'spotify,apple_music')
      form.set('file', new Blob([clip as BlobPart], { type: 'audio/wav' }), 'clip.wav')

      const res = await fetchImpl(AUDD_ENDPOINT, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) throw new ProviderError(`AudD returned HTTP ${res.status}`)
      const payload = await res.json().catch(() => {
        throw new ProviderError('AudD returned non-JSON')
      })
      return normalizeAuddResponse(payload)
    },
  }
}
