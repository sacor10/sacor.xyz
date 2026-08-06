// Shared basket-config shapes for the Pay Index. Imported by the frontend
// (to render the basket/methodology pages), by the DB seed step
// (netlify/functions/_lib/payindex/schema.ts), and by the fingerprint check
// (netlify/functions/_lib/payindex/fingerprint.ts). Kept dependency-free so
// it's safe on both sides of the client/server boundary.

export interface Job {
  id: string
  title: string
  category: string
  // Keyword phrases used by every source tier to match this job title
  // against postings, ATS listings, and role-specific pay schedules. Never
  // used to substitute a *different* title — only to find postings for
  // this exact one.
  canonicalKeywords: string[]
  // Phrases that disqualify an otherwise-keyword-matching posting/listing —
  // e.g. "Nurse Practitioner" must never match "Registered Nurse". Matching
  // stays conservative on purpose: a missed posting is an honest gap, a
  // false positive corrupts a cell.
  negativeKeywords: string[]
  addedAt: string
  active: boolean
  basketVersion: string
}

export type Region = 'Northeast' | 'Midwest' | 'South' | 'West'

// posting    = an individual job posting/listing (Adzuna, ATS feeds)
// scale      = a published, precise rate for a specific classification/step
//              (union wage scale, school district salary schedule) — not an
//              average of anything, so it's still a first-class observation
// aggregate  = the source already averaged/summarized many data points
//              (Levels.fyi per-level medians). Stored and displayed, but the
//              aggregation step excludes 'aggregate' sources from cell
//              medians — rule 7, "never average an already-averaged figure".
export type SourceKind = 'posting' | 'scale' | 'aggregate'

export interface Source {
  id: string
  name: string
  kind: SourceKind
  tier: 'A' | 'B' | 'C'
  licenseNote: string
  attributionRequired: boolean
  attributionText: string
  homepageUrl: string
}

export type ChangeType =
  | 'basket_created'
  | 'add_job'
  | 'remove_job'
  | 'add_city'
  | 'remove_city'
  | 'methodology_change'
  | 'source_added'
  | 'source_removed'

export interface ChangelogEntry {
  effectiveDate: string
  basketVersion: string
  methodologyVersion: string
  changeType: ChangeType
  detail: string
}

export interface City {
  id: string
  name: string
  region: Region
  stateAbbr: string
  // Location string formatted the way Adzuna's `where` query param expects
  // it (Tier A adapter config — not a DB column).
  adzunaLocation: string
  addedAt: string
  active: boolean
  basketVersion: string
}
