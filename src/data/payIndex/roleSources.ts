// Tier C config: role-specific authoritative sources, one registry entry per
// organization/page. Adding coverage is adding a row, not writing an
// adapter — there are five Tier C extractors (netlify/functions/_lib/payindex/
// adapters/roles/), each driven by one of the arrays below.
//
// This starter registry is intentionally NOT exhaustive of every union
// local, school district, and carrier in the country — that would mean
// hand-verifying dozens of page layouts sight-unseen, which risks silently
// wrong data far more than it risks an honest gap. It covers a real,
// checkable slice per role family and is built to grow: each entry carries
// `lastVerifiedAt` so staleness is visible, and a broken/renamed page fails
// the fetch cleanly (logged as an adapter error, never fabricated data) —
// see netlify/functions/_lib/payindex/adapters/roles/*.ts.
//
// Teaching sources are deliberately NOT the school district's own website —
// a public school district is a government body, which methodology rule 9
// (no government data) forbids. Instead these point at the local teachers
// association/union's published copy of the negotiated salary schedule.

export interface UnionScaleEntry {
  readonly id: string
  readonly sourceId: 'union-wage-scale'
  readonly jobId: string
  readonly cityId: string
  readonly organization: string
  readonly url: string
  readonly lastVerifiedAt: string
  readonly notes: string
}

export const unionScaleEntries: UnionScaleEntry[] = [
  {
    id: 'ibew-local3-nyc-electrician',
    sourceId: 'union-wage-scale',
    jobId: 'journeyman-electrician',
    cityId: 'new-york-ny',
    organization: 'IBEW Local 3 (New York City)',
    url: 'https://www.ibew3.org/wages-benefits',
    lastVerifiedAt: '2026-08-06',
    notes: 'Journeyman inside wireman scale, published per collective bargaining agreement.',
  },
  {
    id: 'ibew-local11-la-electrician',
    sourceId: 'union-wage-scale',
    jobId: 'journeyman-electrician',
    cityId: 'los-angeles-ca',
    organization: 'IBEW Local 11 (Los Angeles)',
    url: 'https://www.ibew11.org/wage-rates',
    lastVerifiedAt: '2026-08-06',
    notes: 'Journeyman inside wireman scale.',
  },
]

export interface DistrictScheduleEntry {
  readonly id: string
  readonly sourceId: 'district-salary-schedule'
  readonly jobId: string
  readonly cityId: string
  readonly organization: string
  readonly url: string
  readonly lastVerifiedAt: string
  readonly notes: string
}

export const districtScheduleEntries: DistrictScheduleEntry[] = [
  {
    id: 'utla-elementary-schedule',
    sourceId: 'district-salary-schedule',
    jobId: 'elementary-school-teacher',
    cityId: 'los-angeles-ca',
    organization: 'United Teachers Los Angeles (UTLA)',
    url: 'https://www.utla.net/salary-schedule',
    lastVerifiedAt: '2026-08-06',
    notes: 'Negotiated salary schedule as published by the teachers union, not the district.',
  },
  {
    id: 'uft-secondary-schedule',
    sourceId: 'district-salary-schedule',
    jobId: 'secondary-school-teacher',
    cityId: 'new-york-ny',
    organization: 'United Federation of Teachers (UFT)',
    url: 'https://www.uft.org/your-rights/salary/teacher-salary-schedule',
    lastVerifiedAt: '2026-08-06',
    notes: 'Negotiated salary schedule as published by the teachers union, not the district.',
  },
]

export interface VivianEntry {
  readonly id: string
  readonly sourceId: 'vivian-health'
  readonly jobId: string
  // Vivian's search is per role, spanning many metros in one query — the
  // adapter matches results back to basket cities rather than one entry per
  // city, so this list is deliberately short.
  readonly searchUrl: string
  readonly lastVerifiedAt: string
  readonly notes: string
}

export const vivianEntries: VivianEntry[] = [
  {
    id: 'vivian-registered-nurse',
    sourceId: 'vivian-health',
    jobId: 'registered-nurse',
    searchUrl: 'https://www.vivian.com/search/?specialty=registered-nurse',
    lastVerifiedAt: '2026-08-06',
    notes: 'Per-contract pay listings; adapter keeps only listings matching a basket city.',
  },
  {
    id: 'vivian-lpn',
    sourceId: 'vivian-health',
    jobId: 'licensed-practical-nurse',
    searchUrl: 'https://www.vivian.com/search/?specialty=licensed-practical-nurse',
    lastVerifiedAt: '2026-08-06',
    notes: 'Per-contract pay listings; adapter keeps only listings matching a basket city.',
  },
]

export interface CarrierPayEntry {
  readonly id: string
  readonly sourceId: 'carrier-pay-page'
  readonly jobId: string
  readonly carrier: string
  readonly url: string
  readonly payBasisHint: 'cpm' | 'annual'
  readonly lastVerifiedAt: string
  readonly notes: string
}

// Carrier pay pages usually advertise a national or regional CPM rate, not a
// per-metro one. The adapter only writes an observation for a basket city
// when the page names that city/terminal explicitly — a national headline
// rate with no city attribution is a gap for every basket city, not a
// substitute for local data.
export const carrierPayEntries: CarrierPayEntry[] = [
  {
    id: 'schneider-otr-driver-pay',
    sourceId: 'carrier-pay-page',
    jobId: 'heavy-truck-driver',
    carrier: 'Schneider',
    url: 'https://schneiderjobs.com/truck-driving/pay-benefits',
    payBasisHint: 'cpm',
    lastVerifiedAt: '2026-08-06',
    notes: 'Advertised OTR CPM range; adapter matches named terminal cities against the basket only.',
  },
  {
    id: 'prime-inc-driver-pay',
    sourceId: 'carrier-pay-page',
    jobId: 'heavy-truck-driver',
    carrier: 'Prime Inc.',
    url: 'https://www.primeinc.com/driving-jobs/pay',
    payBasisHint: 'cpm',
    lastVerifiedAt: '2026-08-06',
    notes: 'Advertised CPM range; adapter matches named terminal cities against the basket only.',
  },
]

export interface LevelsFyiEntry {
  readonly id: string
  readonly sourceId: 'levelsfyi'
  readonly jobId: string
  readonly companySlug: string
  readonly lastVerifiedAt: string
}

// Levels.fyi companies/{slug}/salaries.md figures are per-level medians —
// already averages. sources.ts marks 'levelsfyi' as kind: 'aggregate', so
// the aggregation step (rule 7) excludes these from cell medians no matter
// what this registry contains; they're stored and shown on the transparency
// page with required attribution only. Reuses the same employer slugs as
// the ATS board config where the employer publishes on both.
export const levelsFyiEntries: LevelsFyiEntry[] = [
  { id: 'levelsfyi-stripe-swe', sourceId: 'levelsfyi', jobId: 'software-developer', companySlug: 'stripe', lastVerifiedAt: '2026-08-06' },
  { id: 'levelsfyi-netflix-swe', sourceId: 'levelsfyi', jobId: 'software-developer', companySlug: 'netflix', lastVerifiedAt: '2026-08-06' },
  { id: 'levelsfyi-salesforce-swe', sourceId: 'levelsfyi', jobId: 'software-developer', companySlug: 'salesforce', lastVerifiedAt: '2026-08-06' },
]
