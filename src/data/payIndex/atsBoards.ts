// Tier B config: which employers to pull from each of the four ATS
// platforms. This is the entire "extend Tier B" surface — adding an employer
// is adding a row here, never writing new adapter code (there are exactly
// four extractors, one per platform, in
// netlify/functions/_lib/payindex/adapters/ats/).
//
// Board tokens are public identifiers embedded in each employer's careers
// page URL, not secrets. They do drift when an employer switches ATS
// vendors or renames a board — a stale token fails the fetch (404/empty
// response), which the ingest pipeline treats as an adapter error/zero-rows
// event (logged + alerted), never as silent bad data. `lastVerifiedAt` marks
// when a human last confirmed the token resolves; treat entries older than a
// few months with suspicion and re-check before relying on them.
//
// This is a starter set spanning employers plausibly relevant to the pay
// basket's job categories (mostly tech/software, since that's where public
// ATS boards concentrate); it is intentionally small and meant to grow.

export interface GreenhouseBoard {
  platform: 'greenhouse'
  employer: string
  token: string
  lastVerifiedAt: string
}

export interface LeverBoard {
  platform: 'lever'
  employer: string
  token: string
  lastVerifiedAt: string
}

export interface AshbyBoard {
  platform: 'ashby'
  employer: string
  token: string
  lastVerifiedAt: string
}

export interface WorkdayBoard {
  platform: 'workday'
  employer: string
  tenant: string
  dataCenter: string
  site: string
  lastVerifiedAt: string
}

export const greenhouseBoards: GreenhouseBoard[] = [
  { platform: 'greenhouse', employer: 'Stripe', token: 'stripe', lastVerifiedAt: '2026-08-06' },
  { platform: 'greenhouse', employer: 'GitLab', token: 'gitlab', lastVerifiedAt: '2026-08-06' },
  { platform: 'greenhouse', employer: 'Coinbase', token: 'coinbase', lastVerifiedAt: '2026-08-06' },
  { platform: 'greenhouse', employer: 'Robinhood', token: 'robinhood', lastVerifiedAt: '2026-08-06' },
]

export const leverBoards: LeverBoard[] = [
  { platform: 'lever', employer: 'Netflix', token: 'netflix', lastVerifiedAt: '2026-08-06' },
  { platform: 'lever', employer: 'Palantir', token: 'palantir', lastVerifiedAt: '2026-08-06' },
]

export const ashbyBoards: AshbyBoard[] = [
  { platform: 'ashby', employer: 'Ramp', token: 'ramp', lastVerifiedAt: '2026-08-06' },
  { platform: 'ashby', employer: 'Linear', token: 'linear', lastVerifiedAt: '2026-08-06' },
]

export const workdayBoards: WorkdayBoard[] = [
  {
    platform: 'workday',
    employer: 'Salesforce',
    tenant: 'salesforce',
    dataCenter: 'wd1',
    site: 'External_Career_Site',
    lastVerifiedAt: '2026-08-06',
  },
]
