// Computes a deterministic fingerprint of the job+city basket. Used to
// enforce methodology rule 1 ("fixed basket, changed only via an explicit,
// dated, versioned migration — never silently"): the checked-in
// BASKET_FINGERPRINT in src/data/payIndex/basket.ts must equal what this
// function computes from the live jobs.ts/cities.ts data, or
// tests/payindex/fingerprint.test.ts fails the build. Ingest re-checks the
// same equality against the value recorded for the basket version in the DB
// and aborts on mismatch (see schema.ts / the ingest CLI).
//
// Pure, dependency-free (no node:crypto) so it runs identically in the
// browser, in Vitest, in the Netlify function runtime, and in the CLI.

import type { Job, City } from '../../../../src/data/payIndex/types.ts'

function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function canonicalize(jobs: Job[], cities: City[]): string {
  const canonicalJobs = [...jobs]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((j) => ({
      id: j.id,
      title: j.title,
      category: j.category,
      canonicalKeywords: [...j.canonicalKeywords].sort(),
      negativeKeywords: [...j.negativeKeywords].sort(),
    }))
  const canonicalCities = [...cities]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => ({ id: c.id, name: c.name, region: c.region }))
  return JSON.stringify({ jobs: canonicalJobs, cities: canonicalCities })
}

// Two FNV-1a passes over the string and its reverse, concatenated, to cut
// down accidental-collision risk beyond a single 32-bit hash — this is a
// change-detector, not a security primitive, so this is deliberately simple
// rather than pulling in a crypto dependency for a config-diffing check.
export function computeBasketFingerprint(jobs: Job[], cities: City[]): string {
  const canonical = canonicalize(jobs, cities)
  const forward = fnv1a(canonical)
  const reverse = fnv1a(canonical.split('').reverse().join(''))
  return `${forward}${reverse}`
}
