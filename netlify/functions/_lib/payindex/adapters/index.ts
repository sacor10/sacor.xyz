// The single adapter contract every Tier A/B/C source implements. Matches
// the spec's fetchObservations(job, city, period) => Observation[], with
// one addition: a fourth `ctx` argument carrying the injected, policy-
// enforcing HTTP client (rate limiting, robots.txt, the government-host
// guard, disk caching — see http.ts) plus a logger and a clock. Adapters
// must never call fetch() directly; going through ctx is what makes every
// adapter testable with zero network access (tests inject a stub ctx) and
// what makes the source-hygiene rules apply uniformly across all three
// tiers instead of being re-implemented, or forgotten, per adapter.

import type { Job, City } from '../../../../../src/data/payIndex/types.ts'
import type { Observation } from '../types.ts'
import type { HttpContext } from '../http.ts'

export interface AdapterContext {
  readonly period: string
  readonly http: HttpContext
  readonly log: (event: string, detail?: Record<string, unknown>) => void
}

export interface SourceAdapter {
  readonly id: string
  readonly tier: 'A' | 'B' | 'C'
  // Every registry source id (sources.ts) this adapter can emit
  // observations for — used to attribute adapter-health rows per source.
  readonly sourceIds: readonly string[]
  // Throws a descriptive error if required config/credentials are missing.
  // Runs for every adapter before the ingest run writes anything, so a
  // misconfigured adapter aborts loudly instead of silently producing a
  // zero-row run that looks like a legitimate coverage gap (rule 8).
  preflight(): Promise<void>
  // Whether this adapter claims to have data for this (job, city) pair at
  // all. Tier A claims everything; Tier B claims whatever its configured
  // employer boards plausibly cover; Tier C claims only the specific
  // entries in its registry. Cheap, synchronous — no network.
  covers(job: Job, city: City): boolean
  fetchObservations(job: Job, city: City, period: string, ctx: AdapterContext): Promise<Observation[]>
}
