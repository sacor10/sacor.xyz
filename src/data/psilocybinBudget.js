// Where the money for Oregon Psilocybin Services (OPS) actually comes from —
// the funding-source story behind the fee crisis.
//
// The program's cost is not the interesting part; who *pays* that cost is. Over
// three biennia, taxpayer (General Fund) support goes $2.2M → $3.1M → $0, while
// the entire load shifts onto license fees. That shift — not malice — is what
// forces fees up and puts service centers at risk.
//
// Every figure below is drawn from official Oregon budget documents. The
// object-code expenditure detail (salaries vs. IT vs. legal, etc.) comes from
// the OHA 2023-25 Governor's Budget detail volume: the ORBITS "Essential and
// Policy Package Fiscal Impact Summary" (report BPR013) for Package 449 —
// "OR Psilocybin Services Regulatory Framework" (44300-030-05), pp. 1073-74,
// and the Package 449 policy-package narrative, pp. 1584-95. Full source PDFs
// are archived on the repo's GitHub release tagged `data`.

// Canonical online copies of the committed source PDFs.
const SRC = {
  lab2527:
    'https://olis.oregonlegislature.gov/liz/2025I1/Downloads/CommitteeMeetingDocument/310570', // 2025-27 Legislatively Adopted Budget — OHA new/expanded programs (appropriation detail)
  review2527:
    'https://olis.oregonlegislature.gov/liz/2025R1/Downloads/CommitteeMeetingDocument/290024', // LFO 2025-27 Budget Review — OHA
  review2325:
    'https://olis.oregonlegislature.gov/liz/2023R1/Downloads/CommitteeMeetingDocument/263540', // LFO 2023-25 Budget Review — OHA
  waysMeans2527:
    'https://olis.oregonlegislature.gov/liz/2025R1/Downloads/CommitteeMeetingDocument/288940', // 2025-27 Ways & Means — OHA Public Health Division narrative
  budgetReport5525:
    'https://olis.oregonlegislature.gov/liz/2023R1/Downloads/MeasureAnalysisDocument/80416', // SB 5525 (2023) Budget Report — Package 449 line item
  gbDetail2325:
    'https://www.oregon.gov/oha/Budget/2023-25-OHA-Governor-Budget.pdf', // OHA 2023-25 Governor's Budget detail volume (BPR013 for Pkg 449, pp.1073-74)
}

// Funding by biennium. generalFund + fees = total (except where `feesApprox`).
// segments feed the stacked-bar view directly.
export const fundingHistory = [
  {
    id: '2021-23',
    biennium: '2021–23',
    phase: 'Development period',
    generalFund: 2200000,
    fees: 0,
    total: 2200000,
    positions: 14,
    fte: 5.52,
    note: 'Two-year rule-writing and start-up period. 100% taxpayer-funded — no licenses existed yet, so the program collected no fees.',
    source: { label: '2025-27 LAB appropriation detail (OHA), Psilocybin (HB 5024)', url: SRC.lab2527 },
  },
  {
    id: '2023-25',
    biennium: '2023–25',
    phase: 'Launch',
    generalFund: 3139672,
    fees: 4115500,
    total: 7255172,
    positions: 22,
    fte: 22,
    note: 'Package 449 (SB 5525): $3,139,672 General Fund + $4,115,500 Other Funds (fee) limitation and 22 positions (22.00 FTE). The General Fund covered roughly one year while fee revenue ramped; fees then came in ~$6.4M below projection.',
    source: { label: 'SB 5525 (2023) Budget Report — Package 449, Oregon Psilocybin Services Regulatory Framework', url: SRC.budgetReport5525 },
  },
  {
    id: '2025-27',
    biennium: '2025–27',
    phase: 'Fee-funded',
    generalFund: 0,
    fees: 6200000, // ≈ program's ~$3.1M/yr cost across two years; General Fund is confirmed $0
    feesApprox: true,
    total: 6200000,
    note: 'No General Fund appropriated. The program must now cover its ~$3.1M/yr cost entirely from license fees — the direct trigger for the proposed fee doubling. (Fee bar ≈ the $3.1M/yr program cost; the $0 General Fund is confirmed.)',
    source: { label: '2025-27 LAB appropriation detail (OHA), Psilocybin Services (HB 2387) — $0', url: SRC.lab2527 },
  },
]

// ---- Where the money goes: OPS expenditure by object code -------------------
// Line-item pricing of Package 449 ("OR Psilocybin Services Regulatory
// Framework", 22 positions / 22.00 FTE) from the ORBITS BPR013 fiscal impact
// summary in the OHA 2023-25 Governor's Budget detail volume (pp. 1073-74).
// The legislature adopted the package at $7,255,172 total ($3,139,672 General
// Fund + $4,115,500 Other Funds, SB 5525); the itemization below is the
// Governor's Budget pricing of the same package ($6,587,395) — the only
// published object-code composition.
export const expenditure2325 = {
  total: 6587395,
  adoptedTotal: 7255172,
  positions: 22,
  fte: 22,
  personalServices: 4699781, // 71.3% of the package
  servicesAndSupplies: 1887614, // 28.7%
  source: {
    label: "OHA 2023-25 Governor's Budget detail volume — BPR013 fiscal impact summary, Pkg 449 (pp. 1073-74)",
    url: SRC.gbDetail2325,
  },
  adoptedSource: {
    label: 'SB 5525 (2023) Budget Report — Package 449',
    url: SRC.budgetReport5525,
  },
  // Chart-ready grouping (sums exactly to `total`).
  groups: [
    {
      id: 'salaries',
      label: 'Staff salaries',
      value: 3037560,
      color: '#6b3fa0',
      detail: 'Class/unclassified salaries and per diem for the 22-person licensing, compliance and administration team.',
    },
    {
      id: 'benefits',
      label: 'Staff benefits & payroll',
      value: 1662221,
      color: '#9b7cc4',
      detail: 'PERS retirement ($544,332), health/flexible benefits ($871,200), Social Security ($232,376), plus small payroll assessments.',
    },
    {
      id: 'it',
      label: 'IT professional services',
      value: 857420,
      color: '#2e7fa8',
      detail: 'Largest non-staff cost: the TLC (Training, Licensing & Compliance) online platform and product-tracking systems.',
    },
    {
      id: 'professional',
      label: 'Professional services',
      value: 594294,
      color: '#2e8b57',
      detail: 'Contracted non-IT services supporting licensing, inspections and program operations.',
    },
    {
      id: 'legal',
      label: 'Attorney General (legal)',
      value: 150000,
      color: '#d98e32',
      detail: 'Department of Justice counsel for the nation-first regulatory framework.',
    },
    {
      id: 'overhead',
      label: 'Office, travel & other',
      value: 285900,
      color: '#9aa7b8',
      detail: 'Office expenses ($129,738), in-state travel for site inspections ($68,187), telecom ($42,420), training ($19,053), equipment & misc ($26,502).',
    },
  ],
  // Raw object-code line items, verbatim from BPR013.
  lineItems: [
    { id: 'sal', category: 'Personal Services', label: 'Salaries and per diem', value: 3037560 },
    { id: 'flex', category: 'Personal Services', label: 'Flexible benefits (health)', value: 871200 },
    { id: 'pers', category: 'Personal Services', label: 'PERS retirement contribution', value: 544332 },
    { id: 'ss', category: 'Personal Services', label: 'Social Security taxes', value: 232376 },
    { id: 'pfmli', category: 'Personal Services', label: 'Paid Family & Medical Leave insurance', value: 12135 },
    { id: 'erb', category: 'Personal Services', label: 'Employment Relations Board assessments', value: 1166 },
    { id: 'wcd', category: 'Personal Services', label: "Workers' comp assessment", value: 1012 },
    { id: 'itps', category: 'Services & Supplies', label: 'IT professional services', value: 857420 },
    { id: 'ps', category: 'Services & Supplies', label: 'Professional services', value: 594294 },
    { id: 'ag', category: 'Services & Supplies', label: 'Attorney General', value: 150000 },
    { id: 'office', category: 'Services & Supplies', label: 'Office expenses', value: 129738 },
    { id: 'travel', category: 'Services & Supplies', label: 'In-state travel', value: 68187 },
    { id: 'telecom', category: 'Services & Supplies', label: 'Telecommunications', value: 42420 },
    { id: 'train', category: 'Services & Supplies', label: 'Employee training', value: 19053 },
    { id: 'prop', category: 'Services & Supplies', label: 'Expendable property ($250–$5,000)', value: 14700 },
    { id: 'osas', category: 'Services & Supplies', label: 'Other services and supplies', value: 11802 },
  ],
}

// Per-person staffing math, derived from the BPR013 line items above: the
// package budgets 22.00 FTE over the 2-year biennium, so each figure is
// (line item ÷ 22 FTE ÷ 2 years). Budgeted averages across the whole team —
// individual salaries by classification are not published at package level.
export const staffAverages = (() => {
  const fte = expenditure2325.fte
  const years = 2
  const salaries = expenditure2325.lineItems.find((li) => li.id === 'sal').value
  const benefits = expenditure2325.personalServices - salaries
  const perYear = (v) => Math.round(v / fte / years)
  return {
    fte,
    years,
    salaryPerYear: perYear(salaries), // avg budgeted salary
    benefitsPerYear: perYear(benefits), // avg PERS + health + payroll
    loadedPerYear: perYear(expenditure2325.personalServices), // fully loaded
    note: 'Budgeted averages: Package 449 personal-services line items ÷ 22.00 FTE ÷ 2 years.',
  }
})()

// The single line item that captures the whole shift: for 2025-27 the budget
// moves ~$3.69M of OPS spending OFF the General Fund and ONTO fees.
export const fundShift = {
  amount: 3690394,
  label: 'General Fund removed / fee revenue added for 2025–27',
  detail:
    'The 2025-27 budget books a “Oregon Psilocybin Services Budget Adjustment” of −$3,690,394 General Fund and +$3,690,394 Other Funds — the taxpayer-to-fees handoff as one line.',
  source: { label: 'LFO 2025-27 Budget Review — OHA (p.12 & p.56)', url: SRC.review2527 },
}

// Why the General Fund had to backfill in the first place: fees badly missed forecast.
export const feeShortfall = {
  amount: 6400000,
  label: '2023–25 fee (Other Funds) revenue shortfall',
  detail:
    'The 2023-25 budget recognized a $6.4M Other Funds revenue shortfall in the psilocybin program — fees came in far below projection, which is why General Fund support was needed to keep it running.',
  source: { label: 'LFO 2023-25 Budget Review — OHA (p.22)', url: SRC.review2325 },
}

// The state's stated plan: no permanent taxpayer support — full transition to fees.
export const transitionPlan = {
  targetBiennium: '2027–29',
  detail:
    'The General Fund was designed to cover only about one year of the 2023-25 biennium; OHA expects the program to transition fully to Other Funds (fees) by the 2027-29 biennium.',
  source: { label: '2025-27 Ways & Means — OHA Public Health Division narrative', url: SRC.waysMeans2527 },
}

export const budgetSources = [
  { label: "OHA 2023-25 Governor's Budget detail volume — Package 449 object-code detail (BPR013, pp. 1073-74) & policy-package narrative (pp. 1584-95)", url: SRC.gbDetail2325 },
  { label: 'SB 5525 (2023) Budget Report — Package 449, Oregon Psilocybin Services Regulatory Framework', url: SRC.budgetReport5525 },
  { label: '2025-27 Legislatively Adopted Budget — OHA new & expanded programs (appropriation detail)', url: SRC.lab2527 },
  { label: 'LFO 2025-27 Budget Review — Oregon Health Authority', url: SRC.review2527 },
  { label: 'LFO 2023-25 Budget Review — Oregon Health Authority', url: SRC.review2325 },
  { label: '2025-27 Ways & Means — OHA Public Health Division program narrative', url: SRC.waysMeans2527 },
]

export const budgetCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

// Compact "$2.2M" style formatter for headline stats.
export function millions(n) {
  return `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`
}
