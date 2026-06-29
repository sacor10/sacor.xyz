// The "why" layer: why Oregon says it has to keep raising psilocybin fees.
//
// Short version — a self-reinforcing fee death spiral:
//   1. Measure 109 designed the program to be funded by license fees, not taxes.
//   2. The general-fund support that quietly propped it up (~$3.1M in 2023–25) is
//      gone for 2025–27 amid Oregon's ~$1B budget shortfall.
//   3. The licensee base is collapsing (≈35 service centers licensed, ≈22 left).
//   4. With no tax lever, fee per licensee = fixed program cost ÷ shrinking base,
//      so fees must rise — which pushes more licensees out, shrinking the base
//      again. Repeat.
//
// Every figure carries a source. Illustrative items are clearly flagged.

export const programFinance = {
  annualCost: 3100000, // ~$3.1M/yr to run the program (Measure 109 backers' estimate)
  generalFundPrior: 3100000, // general-fund appropriation that covered 2023–25
  generalFund2527: 0, // none secured for 2025–27
  shortfall: 3500000, // ~$3.5M reported gap
  serviceCentersLicensed: 35,
  serviceCentersOpen: 22,
  facilitators: 400,
  source: {
    label: 'Willamette Week — service centers closing amid high costs (2025)',
    url: 'https://www.wweek.com/news/2025/06/03/oregons-psychedelic-service-centers-are-closing-amid-high-costs-and-tough-regulation/',
  },
  shortfallSource: {
    label: 'Citizen Portal — providers warn $3.5M shortfall could force higher fees',
    url: 'https://citizenportal.ai/articles/6322329/Psilocybin-service-providers-warn-35M-shortfall-could-force-higher-fees-reduce-rural-access',
  },
}

// Ordered nodes for the death-spiral cycle diagram (loops back to the first).
export const deathSpiralSteps = [
  'Program must fund itself from fees (no tax dollars)',
  'No general-fund backfill amid Oregon’s ~$1B budget hole',
  'Fixed ~$3.1M cost spread across licensees',
  'Fees are the highest in Oregon health care',
  'Service centers close · facilitators leave',
  'Fewer licensees to share the cost',
  'Fee per licensee must rise → fees doubled',
]

// Illustrative cost-recovery math: a fixed program cost divided across a shrinking
// base pushes the per-licensee fee up. Numbers are a simplified illustration of the
// PRINCIPLE (the real budget is shared across facilitators, centers, growers and
// labs) — not an official per-center fee.
export const costRecovery = {
  fixedCost: 3100000,
  note: 'Illustrative: a fixed ~$3.1M program cost ÷ the number of paying licensees. Shows the direction, not an official per-license figure.',
  scenarios: [
    { label: '35 centers (at launch)', base: 35 },
    { label: '22 centers (today)', base: 22 },
    { label: '12 centers (if closures continue)', base: 12 },
  ],
  source: programFinance.source,
}

// Context: this is the worst possible moment to raise fees.
export const context = [
  {
    id: 'mh-rank',
    text: 'Oregon ranks 49th out of 51 for adult access to mental-health care and worst in the nation for prevalence of mental illness — exactly where a working, low-cost option should be protected, not priced out.',
    source: {
      label: 'Oregon Legislature committee document (MHA data)',
      url: 'https://olis.oregonlegislature.gov/liz/2023I1/Downloads/CommitteeMeetingDocument/278862',
    },
  },
  {
    id: 'self-defeating',
    text: 'The increase is self-defeating: the shortfall is driven by service-center closures, and doubling fees makes closures more likely — shrinking the very base the fees depend on. A cost-effective program that could ultimately save the state money is instead being squeezed at its most fragile moment.',
    source: programFinance.shortfallSource,
  },
]

export const takeAction = {
  heading: 'This is a proposal — not yet final. You can weigh in.',
  body: 'The Oregon Health Authority is taking public comment on the proposed fee increase before it is adopted. Decision-makers respond to volume; a short, specific comment from someone affected carries real weight.',
  links: [
    {
      label: 'OHA Oregon Psilocybin Services — rules & public comment',
      url: 'https://www.oregon.gov/oha/ph/preventionwellness/pages/psilocybin-administrative-rules.aspx',
    },
    {
      label: 'Healing Advocacy Fund — take action',
      url: 'https://healingadvocacyfund.org/',
    },
  ],
}
