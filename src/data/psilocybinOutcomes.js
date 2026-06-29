// Evidence layer for the /psilocybin story: clinical outcomes, cost-effectiveness,
// the "who pays" subsidy asymmetry, and a transparent 10-year cost-per-patient model.
//
// Tone (per project decision): defensible and fully cited. Efficacy is framed as
// "comparable-to-better and far more durable per dose, IN CLINICAL TRIALS" — never a
// flat "more effective" claim. Oregon's program is non-medical "supported adult use,"
// which differs from the screened, therapy-supported trial model; that caveat is
// surfaced in the UI.

// ---- Clinical outcomes -------------------------------------------------------
export const outcomes = [
  {
    id: 'psilo-remission',
    label: 'Psilocybin (TRD/MDD), clinical trials',
    metric: '20–57% remission, 37–71% response',
    detail:
      'Across randomized trials, typically from 1–2 dosing sessions. Long-term follow-up has reported ~75% response and ~58% remission at 12 months.',
    source: {
      label: 'Frontiers meta-analysis (2024)',
      url: 'https://www.frontiersin.org/journals/psychiatry/articles/10.3389/fpsyt.2024.1359088/full',
    },
  },
  {
    id: 'psilo-vs-escitalopram',
    label: 'Psilocybin vs. escitalopram (SSRI), head-to-head',
    metric: 'No significant disadvantage',
    detail:
      'In a double-blind RCT, psilocybin showed no significant disadvantage on the primary endpoint vs. a standard SSRI, with several secondary measures favoring psilocybin — from far fewer doses.',
    source: {
      label: 'Lancet eClinicalMedicine, 6-month follow-up (2024)',
      url: 'https://www.thelancet.com/journals/eclinm/article/PIIS2589-5370(24)00378-X/fulltext',
    },
  },
  {
    id: 'trad-stard',
    label: 'Standard antidepressant care (STAR*D)',
    metric: 'Remission falls each step: 37 → 31 → 14 → 13%',
    detail:
      'Roughly 46% of those who reach remission relapse within a year. Major depression is typically recurrent over 16–17 years — an ongoing, repeating course of care.',
    source: {
      label: 'World Psychiatry, STAR*D reappraisal (2024)',
      url: 'https://onlinelibrary.wiley.com/doi/full/10.1002/wps.21169',
    },
  },
]

// ---- Cost-effectiveness ------------------------------------------------------
export const costEffectiveness = [
  {
    id: 'ce-dominance',
    text: 'In model-based analyses, psilocybin-assisted therapy is often "dominant" over standard care for treatment-resistant depression — better outcomes at lower total cost — and is cost-effective in most scenarios when priced at or below ~$5,000 per episode.',
    source: {
      label: 'Nature, Translational Psychiatry (2025)',
      url: 'https://www.nature.com/articles/s41398-025-03556-4',
    },
  },
  {
    id: 'ce-burden',
    text: 'Depression already costs the U.S. an estimated $44 billion/year in direct and indirect costs, and treatment-resistant cases run far higher (e.g., Medicare ~$46k per patient/year; TMS ~$67k/year).',
    source: {
      label: "Becker's Behavioral Health",
      url: 'https://www.beckersbehavioralhealth.com/payer/medicaid/treatment-resistant-depression-costs-medicare-46k-per-patient-annually-report/',
    },
  },
]

// ---- "Who pays" subsidy asymmetry -------------------------------------------
export const subsidy = [
  {
    id: 'trad-paid',
    label: 'Traditional mental-health care',
    who: 'Largely paid by the state / insurers',
    detail:
      "Reimbursed through the Oregon Health Plan (Medicaid is ~$11.5B/yr in Oregon) and commercial insurance. Providers also hold the cheapest licenses ($60–$390/yr).",
    source: {
      label: 'Georgetown CCF — Medicaid in Oregon',
      url: 'https://ccf.georgetown.edu/wp-content/uploads/2025/02/Medicaid-is-Vital-to-Oregon-2025-Fact-Sheet.pdf',
    },
  },
  {
    id: 'psilo-paid',
    label: 'Psilocybin services',
    who: 'Paid 100% out of pocket',
    detail:
      'Schedule I status means no insurance or Medicaid coverage — patients pay ~$1,000–$3,500 per session themselves — while providers hold the most expensive licenses ($2,000–$10,000/yr) and the program receives $0 in tax support.',
    source: {
      label: 'OPB — cost of legal psilocybin in Oregon (2024)',
      url: 'https://www.opb.org/article/2024/05/28/a-year-later-psilocybin-assisted-therapy-is-more-accessible-in-oregon-but-remains-costly/',
    },
  },
]

// ---- Transparent 10-year cost-per-patient model -----------------------------
// All knobs are editable; every default traces to a cited figure. These are
// deliberately conservative, illustrative estimates — not a published Oregon number.
export const lifetimeAssumptions = {
  years: 10,
  // Psilocybin: episodic. Midpoint of Oregon's ~$1,000–$3,500 per-session range,
  // assumed twice over 10 years (initial + one booster). 100% patient-paid.
  psilocybinSessionCost: 2250,
  psilocybinSessionsPer10yr: 2,
  psilocybinStatePaidShare: 0, // Schedule I → no coverage, no subsidy
  // Traditional: chronic/recurring. ~$1,500/yr outpatient care, every year.
  traditionalAnnualCost: 1500,
  // Share borne by the state/insurer for a covered (e.g., OHP) patient.
  traditionalStatePaidShare: 0.8,
  notes: {
    psilocybinSessionCost:
      'Midpoint of Oregon’s reported $1,000–$3,500 per-session range (OPB, 2024).',
    psilocybinSessionsPer10yr:
      'Trials use 1–2 dosing sessions with durable effect; modeled as 2 over 10 years.',
    traditionalAnnualCost:
      '~$1,500/yr average outpatient depression care (Peterson-KFF). TRD runs far higher.',
    traditionalStatePaidShare:
      'Illustrative payer share for a covered/OHP patient; psilocybin gets 0% (no coverage).',
  },
  source: {
    label: 'Peterson-KFF — depression treatment costs',
    url: 'https://www.healthsystemtracker.org/brief/privately-insured-people-with-depression-and-anxiety-face-high-out-of-pocket-costs/',
  },
}

// Returns 10-year totals split by payer for each treatment path.
export function computeLifetime(a = lifetimeAssumptions) {
  const psiloTotal = a.psilocybinSessionCost * a.psilocybinSessionsPer10yr
  const tradTotal = a.traditionalAnnualCost * a.years
  return {
    psilocybin: {
      id: 'psilocybin',
      label: 'Psilocybin (episodic)',
      total: psiloTotal,
      statePaid: psiloTotal * a.psilocybinStatePaidShare,
      patientPaid: psiloTotal * (1 - a.psilocybinStatePaidShare),
    },
    traditional: {
      id: 'traditional',
      label: 'Traditional care (chronic)',
      total: tradTotal,
      statePaid: tradTotal * a.traditionalStatePaidShare,
      patientPaid: tradTotal * (1 - a.traditionalStatePaidShare),
    },
  }
}

// ---- Subsidy-inversion quadrant ---------------------------------------------
// Two entities plotted on: x = how much the state helps pay for the treatment
// (0 = patient pays all, 100 = state pays all); y = how much the state charges to
// be licensed to provide it (0 = cheapest licenses, 100 = most expensive).
export const inversionPoints = [
  {
    id: 'traditional',
    label: 'Traditional care',
    x: 80, // largely state/insurer-funded
    y: 12, // cheapest licenses ($60–$390/yr)
    category: 'traditional',
    caption: 'State helps pay · cheap to be licensed',
  },
  {
    id: 'psilocybin',
    label: 'Psilocybin',
    x: 0, // 100% out of pocket, $0 state
    y: 92, // most expensive licenses ($2,000–$10,000/yr)
    category: 'psilocybin',
    caption: 'State pays nothing · most expensive to be licensed',
  },
]

export const inversionAxes = {
  x: 'How much the state helps pay for the treatment →',
  y: 'How much the state charges to be licensed to provide it ↑',
}
