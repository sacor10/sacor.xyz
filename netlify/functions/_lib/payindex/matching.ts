// Conservative job/city matching shared by every adapter that has to decide
// whether a posting or listing belongs to a specific basket cell. Matching
// stays deliberately strict: a missed posting is an honest gap (rule 4
// handles that correctly — it's a lower observation count, not a wrong
// number), but a false-positive match corrupts a cell's median silently.
// When in doubt, this code says no.

import type { Job, City } from '../../../../src/data/payIndex/types.ts'

// A handful of common metro nicknames that free-text location fields use
// and a bare city-name match would otherwise miss. Deliberately NOT part of
// the versioned basket (cities.ts) — these are a matching aid, not basket
// identity, so they can be extended without a basket version bump.
const CITY_ALIASES: Record<string, string[]> = {
  'new-york-ny': ['nyc', 'new york city', 'manhattan', 'brooklyn'],
  'los-angeles-ca': ['la', 'l.a.'],
  'san-francisco-ca': ['sf', 'bay area'],
}

export function matchesJob(text: string, job: Job): boolean {
  const lower = text.toLowerCase()
  const hasPositive = job.canonicalKeywords.some((k) => lower.includes(k.toLowerCase()))
  if (!hasPositive) return false
  const hasNegative = job.negativeKeywords.some((k) => lower.includes(k.toLowerCase()))
  return !hasNegative
}

const REMOTE_PATTERN = /\bremote\b/i

export function matchesCity(locationText: string, city: City): boolean {
  const lower = locationText.toLowerCase()
  const names = [city.name.toLowerCase(), ...(CITY_ALIASES[city.id] ?? [])]
  const nameMatches = names.some((n) => lower.includes(n))

  if (!nameMatches) return false

  // A posting marked "Remote" that ALSO happens to mention the city name in
  // passing (e.g. "Remote — must reside near New York, NY") is ambiguous
  // enough to reject: this index measures pay for work actually anchored to
  // a metro, not a remote role that mentions it. Only reject when the
  // location text is remote-first and doesn't clearly still anchor there
  // (i.e. "Remote" appears and the city name is not the leading token).
  if (REMOTE_PATTERN.test(lower) && !lower.trim().startsWith(names[0])) return false

  return true
}
