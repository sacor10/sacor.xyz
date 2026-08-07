// Source registry for the Pay Index. Every observation stored in the DB
// carries a source_id that must resolve to a row here (or one seeded from
// atsBoards.ts / roleSources.ts — see those files for per-employer and
// per-organization entries).
//
// `kind` is what makes methodology rule 7 ("never average an
// already-averaged figure into the headline") real: the aggregation step
// (netlify/functions/_lib/payindex/aggregate.ts) only pools observations
// from sources whose kind is 'posting' or 'scale'. 'aggregate' sources are
// stored and shown on the transparency page with attribution, but structurally
// cannot reach a cell median.
//
// No government sources anywhere in this file, or in atsBoards.ts / roleSources.ts
// — enforced by a test that walks every configured URL and rejects .gov/.mil/
// .k12.*.us/.state.*.us hosts (see tests/payindex/sources.test.ts).

import type { Source } from './types'

export const sources: Source[] = [
  {
    id: 'adzuna',
    name: 'Adzuna',
    kind: 'posting',
    tier: 'A',
    licenseNote: 'Adzuna free developer API. Attribution required per Adzuna API terms.',
    attributionRequired: true,
    attributionText: 'Jobs by Adzuna',
    homepageUrl: 'https://www.adzuna.com',
  },
  {
    id: 'ats-greenhouse',
    name: 'Greenhouse job boards',
    kind: 'posting',
    tier: 'B',
    licenseNote: 'Public per-employer Greenhouse job board JSON API. No login required, no rate-limit-bypassing.',
    attributionRequired: false,
    attributionText: '',
    homepageUrl: 'https://www.greenhouse.io',
  },
  {
    id: 'ats-lever',
    name: 'Lever job postings',
    kind: 'posting',
    tier: 'B',
    licenseNote: 'Public per-employer Lever postings JSON API.',
    attributionRequired: false,
    attributionText: '',
    homepageUrl: 'https://www.lever.co',
  },
  {
    id: 'ats-ashby',
    name: 'Ashby job board',
    kind: 'posting',
    tier: 'B',
    licenseNote: 'Public per-employer Ashby job board API, includes structured compensation when published.',
    attributionRequired: false,
    attributionText: '',
    homepageUrl: 'https://www.ashbyhq.com',
  },
  {
    id: 'ats-workday',
    name: 'Workday career sites',
    kind: 'posting',
    tier: 'B',
    licenseNote: 'Public per-employer Workday CXS job feed.',
    attributionRequired: false,
    attributionText: '',
    homepageUrl: 'https://www.workday.com',
  },
  {
    id: 'union-wage-scale',
    name: 'Published union local wage scales',
    kind: 'scale',
    tier: 'C',
    licenseNote: 'Publicly posted wage scales from union local websites (IBEW, UA, and similar building-trades locals). One observation per classification/step.',
    attributionRequired: false,
    attributionText: '',
    homepageUrl: 'https://www.ibew.org',
  },
  {
    id: 'district-salary-schedule',
    name: 'Teacher salary schedules (union-published)',
    kind: 'scale',
    tier: 'C',
    licenseNote: 'Negotiated teacher salary schedules as published by the local teachers association/union, not by the school district itself (district sites are government sources and are excluded by rule 9). One observation per step/lane.',
    attributionRequired: false,
    attributionText: '',
    homepageUrl: 'https://www.nea.org',
  },
  {
    id: 'vivian-health',
    name: 'Vivian Health',
    kind: 'posting',
    tier: 'C',
    licenseNote: 'Openly posted per-contract nursing/travel-nursing pay listings.',
    attributionRequired: true,
    attributionText: 'Data source: Vivian Health',
    homepageUrl: 'https://www.vivian.com',
  },
  {
    id: 'carrier-pay-page',
    name: 'Carrier driver pay pages',
    kind: 'posting',
    tier: 'C',
    licenseNote: 'Advertised CPM/annual driver pay as published on individual carrier recruiting pages.',
    attributionRequired: false,
    attributionText: '',
    homepageUrl: '',
  },
  {
    id: 'levelsfyi',
    name: 'Levels.fyi',
    kind: 'aggregate',
    tier: 'C',
    licenseNote:
      'UNVERIFIED SOURCE — Levels.fyi has no official public API; the /companies/{slug}/salaries.md URL this adapter targets is reported third-party as a crawler-facing export, not documented by Levels.fyi itself, and could not be confirmed to resolve from this project\'s environment. Verify the URL and current robots.txt/ToS before relying on this adapter. If usable, figures are already medians of submitted data points — excluded from the headline cell calculation by design (methodology rule 7), stored and displayed for context only, with required attribution.',
    attributionRequired: true,
    attributionText: 'Data source: Levels.fyi',
    homepageUrl: 'https://www.levels.fyi',
  },
]
