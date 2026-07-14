// Oregon mental-health licensing fees — single source of truth for the
// /psilocybin data explorer.
//
// Methodology
// -----------
// "Annual cost" is the recurring license/registration fee divided by its renewal
// period (annual = 1 year, biennial = 2 years). One-time application/exam fees
// are tracked separately in `upfront` and are NOT folded into the annual figure,
// so the bar chart compares apples to apples (ongoing cost of holding the
// license). First-year totals (upfront + first year of recurring) are shown
// separately in the stacked-bar view.
//
// Every figure is sourced from the official Oregon board fee schedule listed in
// `sourceUrl`. Figures verified June 2026.

export const metadata = {
  asOf: 'June 29, 2026',
  title: 'Oregon Mental-Health Licensing Costs',
  subtitle:
    'What it costs to be licensed to help people in Oregon — psilocybin vs. every other mental-health profession.',
  methodology:
    'Annual cost = recurring license fee ÷ renewal period. One-time application and exam fees are listed separately and are not included in the annual figure. All amounts are from official Oregon licensing board fee schedules.',
  // The proposed increase is now confirmed: in late June 2026 OHA proposed
  // DOUBLING the operating-license fees. Facilitator and service-center figures
  // are confirmed; manufacturer/lab/worker are expected to follow but not yet
  // charted (see `proposedPending`).
  proposedAnnounced: 'June 2026',
  proposedNote:
    'In late June 2026, the Oregon Health Authority formally proposed DOUBLING psilocybin licensing fees: facilitators from $2,000 to $4,000/year and service centers from $10,000 to $20,000/year. The program is required by law to fund itself entirely from licensing fees, and the general-fund support that propped it up in 2023–25 (~$3.1M) is not coming for 2025–27 amid Oregon’s ~$1B budget shortfall. With a shrinking licensee base, OPS says higher fees are the only way to cover a reported ~$3.5M gap — even though doubling fees risks pushing more service centers to close.',
}

// category: 'psilocybin' | 'traditional'
// upfront:    one-time application/initial/exam fees (USD)
// recurring:  recurring license/registration fee (USD)
// periodYears: renewal period for the recurring fee (1 = annual, 2 = biennial)
export const licenses = [
  // ---- Psilocybin (Oregon Psilocybin Services, OAR 333-333) ----
  {
    id: 'psilo-service-center',
    name: 'Psilocybin Service Center',
    short: 'Psilocybin service center',
    board: 'Oregon Psilocybin Services (OHA)',
    boardUrl:
      'https://www.oregon.gov/oha/ph/preventionwellness/pages/psilocybin-license-service-center-operator.aspx',
    category: 'psilocybin',
    upfront: 500,
    recurring: 10000,
    proposedRecurring: 20000,
    periodYears: 1,
    notes: 'The only place clients may legally consume psilocybin.',
  },
  {
    id: 'psilo-manufacturer',
    name: 'Psilocybin Manufacturer',
    short: 'Psilocybin manufacturer',
    board: 'Oregon Psilocybin Services (OHA)',
    boardUrl:
      'https://www.oregon.gov/oha/ph/preventionwellness/pages/psilocybin-license-manufacturer.aspx',
    category: 'psilocybin',
    upfront: 500,
    recurring: 10000,
    proposedPending: true,
    periodYears: 1,
    notes: 'Cultivation / processing of psilocybin products.',
  },
  {
    id: 'psilo-lab',
    name: 'Psilocybin Testing Laboratory',
    short: 'Psilocybin testing lab',
    board: 'Oregon Psilocybin Services (OHA)',
    boardUrl:
      'https://www.oregon.gov/oha/ph/preventionwellness/pages/psilocybin-license-lab-testing.aspx',
    category: 'psilocybin',
    upfront: 500,
    recurring: 10000,
    proposedPending: true,
    periodYears: 1,
    notes: 'Potency, identity and solvent testing.',
  },
  {
    id: 'psilo-facilitator',
    name: 'Psilocybin Facilitator',
    short: 'Psilocybin facilitator',
    board: 'Oregon Psilocybin Services (OHA)',
    boardUrl:
      'https://www.oregon.gov/oha/ph/preventionwellness/pages/psilocybin-license-facilitator.aspx',
    category: 'psilocybin',
    upfront: 150,
    recurring: 2000,
    proposedRecurring: 4000,
    periodYears: 1,
    notes:
      'The person who sits with clients. Renewed annually. Reduced fee of $1,000/yr for veterans, SSI, SNAP, or OHP enrollees. Excludes ~$2,000+ in required third-party training.',
  },
  {
    id: 'psilo-worker',
    name: 'Psilocybin Worker Permit',
    short: 'Psilocybin worker permit',
    board: 'Oregon Psilocybin Services (OHA)',
    boardUrl:
      'https://www.oregon.gov/oha/ph/preventionwellness/pages/psilocybin-worker-permit.aspx',
    category: 'psilocybin',
    upfront: 0,
    recurring: 25,
    proposedPending: true,
    periodYears: 1,
    notes: 'Required for staff at licensed premises. Valid one year (as of 1/1/2025).',
  },

  // ---- Traditional mental-health licenses ----
  {
    id: 'psychiatrist',
    name: 'Psychiatrist (MD/DO)',
    short: 'Psychiatrist (MD/DO)',
    board: 'Oregon Medical Board',
    boardUrl: 'https://www.oregon.gov/omb/licensing/pages/fees.aspx',
    category: 'traditional',
    upfront: 427, // $375 application + $52 criminal records check
    recurring: 253,
    periodYears: 1,
    notes: '$375 application + $52 records check; $253/yr annual registration.',
  },
  {
    id: 'psychologist',
    name: 'Psychologist',
    short: 'Psychologist',
    board: 'Oregon Board of Psychology',
    boardUrl: 'https://www.oregon.gov/psychology/pages/fees.aspx',
    category: 'traditional',
    upfront: 370, // application incl. $45 background check (exam fees paid to ASPPB separately)
    recurring: 780,
    periodYears: 2,
    notes: '$370 application; $780 active license fee per 2-year cycle.',
  },
  {
    id: 'lpc-lmft',
    name: 'Counselor / Therapist (LPC / LMFT)',
    short: 'Counselor (LPC/LMFT)',
    board: 'Board of Licensed Professional Counselors & Therapists',
    boardUrl: 'https://www.oregon.gov/oblpct/pages/fees.aspx',
    category: 'traditional',
    upfront: 175,
    recurring: 290,
    periodYears: 2,
    notes: '$175 application; $290 active renewal per 2-year cycle.',
  },
  {
    id: 'lcsw',
    name: 'Clinical Social Worker (LCSW)',
    short: 'Social worker (LCSW)',
    board: 'Board of Licensed Social Workers',
    boardUrl: 'https://www.oregon.gov/blsw/pages/renewalsstatuschange.aspx',
    category: 'traditional',
    upfront: 260,
    recurring: 120,
    periodYears: 2,
    notes: '$260 application; $120 renewal per 2-year cycle.',
  },
]

// Annualized recurring cost for a license.
export function annualCost(license) {
  return license.recurring / license.periodYears
}

// First-year total: one-time upfront + one year of recurring cost.
export function firstYearCost(license) {
  return license.upfront + annualCost(license)
}

// Annualized proposed cost, or null if no confirmed proposed figure exists.
export function proposedAnnual(license) {
  if (license.proposedRecurring == null) return null
  return license.proposedRecurring / license.periodYears
}

// Licenses with a confirmed proposed increase (for the current-vs-proposed chart).
export const licensesWithProposed = licenses.filter(
  (l) => l.proposedRecurring != null,
)

// Average annual cost across the traditional (non-psilocybin) licenses — the
// baseline the ratio chart compares psilocybin against.
export const traditionalAvgAnnual = (() => {
  const trad = licenses.filter((l) => l.category === 'traditional')
  const total = trad.reduce((sum, l) => sum + annualCost(l), 0)
  return total / trad.length
})()

// Licenses sorted cheapest → most expensive by annual cost (for the main chart).
export const licensesByAnnualAsc = [...licenses].sort(
  (a, b) => annualCost(a) - annualCost(b),
)

export const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
