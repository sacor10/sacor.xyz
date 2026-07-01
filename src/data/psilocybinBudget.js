// Where the money for Oregon Psilocybin Services (OPS) actually comes from —
// the funding-source story behind the fee crisis.
//
// The program's cost is not the interesting part; who *pays* that cost is. Over
// three biennia, taxpayer (General Fund) support goes $2.2M → $3.1M → $0, while
// the entire load shifts onto license fees. That shift — not malice — is what
// forces fees up and puts service centers at risk.
//
// Every figure below is drawn from official Oregon legislative budget documents
// (copies committed under src/assets/). Object-code detail (salaries vs. IT vs.
// inspections) is intentionally NOT modeled: the state budget tracks psilocybin
// at the program level (fund source + positions/FTE), bundled with six other
// sections in the Center for Health Protection, so an internal spending pie is
// not sourceable and is not invented here.

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
