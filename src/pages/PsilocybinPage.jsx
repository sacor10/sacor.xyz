import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './psilocybin/psilocybin.css'
import {
  BarChart,
  StackedBar,
  RatioChart,
  SortableTable,
  QuadrantChart,
  GroupedBar,
  CycleDiagram,
} from './psilocybin/charts'
import {
  metadata,
  licenses,
  licensesByAnnualAsc,
  annualCost,
  proposedAnnual,
  licensesWithProposed,
  traditionalAvgAnnual,
  currency,
} from '../data/psilocybinFees'
import {
  outcomes,
  costEffectiveness,
  subsidy,
  lifetimeAssumptions,
  computeLifetime,
  inversionPoints,
  inversionAxes,
} from '../data/psilocybinOutcomes'
import {
  programFinance,
  deathSpiralSteps,
  costRecovery,
  context as policyContext,
  takeAction,
} from '../data/psilocybinPolicy'
import {
  fundingHistory,
  fundShift,
  feeShortfall,
  transitionPlan,
  budgetSources,
  budgetCurrency,
  millions,
} from '../data/psilocybinBudget'

const periodLabel = (l) => (l.periodYears === 1 ? '/ yr' : `/ ${l.periodYears} yr`)
const ratioOf = (l) => annualCost(l) / traditionalAvgAnnual

// ---- Phase-3 view-model: proposed doubling + cost-recovery ------------------
const proposedBars = licensesWithProposed.map((l) => ({
  id: l.id,
  label: l.short,
  current: annualCost(l),
  proposed: proposedAnnual(l),
}))

const costRecoveryBars = costRecovery.scenarios.map((s) => {
  const feeEach = Math.round(costRecovery.fixedCost / s.base)
  return {
    id: `cr-${s.base}`,
    label: s.label,
    value: feeEach,
    highlight: s.base <= 12,
    valueLabel: `${currency.format(feeEach)} each`,
  }
})

// ---- Budget view-model: who pays for the program, by biennium ---------------
// Stacked bars — General Fund (taxpayer) vs. license fees — one bar per
// biennium. The General Fund segment collapses to zero across the three bars.
const fundingBars = fundingHistory.map((b) => ({
  id: b.id,
  label: `${b.biennium} · ${b.phase}`,
  segments: [
    { label: 'Taxpayer (General Fund)', value: b.generalFund },
    { label: 'License fees', value: b.fees },
  ],
}))

// ---- Phase-2 view-model: 10-year cost split by payer ------------------------
const lifetime = computeLifetime()
const lifetimeBars = [lifetime.traditional, lifetime.psilocybin].map((p) => ({
  id: p.id,
  label: p.label,
  segments: [
    { label: 'Paid by the state / insurer', value: p.statePaid },
    { label: 'Paid by the patient', value: p.patientPaid },
  ],
}))

// ---- Derived view-model -----------------------------------------------------
const mainBars = licensesByAnnualAsc.map((l) => ({
  id: l.id,
  label: l.short,
  value: annualCost(l),
  highlight: l.category === 'psilocybin',
  valueLabel: `${currency.format(annualCost(l))} / yr`,
}))

const facilitator = licenses.find((l) => l.id === 'psilo-facilitator')
const serviceCenter = licenses.find((l) => l.id === 'psilo-service-center')

// First-year vs ongoing composition for a representative set.
const stackIds = ['psilo-service-center', 'psilo-facilitator', 'psychologist', 'lpc-lmft', 'lcsw']
const stackBars = stackIds
  .map((id) => licenses.find((l) => l.id === id))
  .map((l) => ({
    id: l.id,
    label: l.short,
    segments: [
      { label: 'One-time application/exam', value: l.upfront },
      { label: 'First-year license fee', value: annualCost(l) },
    ],
  }))

const ratioBars = licenses
  .filter((l) => l.category === 'psilocybin' && annualCost(l) >= traditionalAvgAnnual)
  .sort((a, b) => ratioOf(b) - ratioOf(a))
  .map((l) => ({ id: l.id, label: l.short, ratio: ratioOf(l), highlight: true }))

// ---- Table ------------------------------------------------------------------
const columns = [
  {
    key: 'name',
    label: 'License',
    render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{r.name}</div>
        <div className="psilo-note-cell">{r.board}</div>
      </div>
    ),
  },
  {
    key: 'upfront',
    label: 'One-time',
    align: 'right',
    render: (r) => (r.upfront ? currency.format(r.upfront) : '—'),
    sortValue: (r) => r.upfront,
  },
  {
    key: 'recurring',
    label: 'Recurring',
    align: 'right',
    render: (r) => `${currency.format(r.recurring)} ${periodLabel(r)}`,
    sortValue: (r) => annualCost(r),
  },
  {
    key: 'annual',
    label: '≈ Annual',
    align: 'right',
    render: (r) => currency.format(annualCost(r)),
    sortValue: (r) => annualCost(r),
    initial: 'desc',
  },
  {
    key: 'ratio',
    label: '× avg. traditional',
    align: 'right',
    render: (r) => {
      const x = ratioOf(r)
      return x >= 10 ? `${Math.round(x)}×` : `${x.toFixed(1)}×`
    },
    sortValue: (r) => ratioOf(r),
  },
  {
    key: 'source',
    label: 'Source',
    render: (r) => (
      <a href={r.boardUrl} target="_blank" rel="noopener noreferrer">
        official ↗
      </a>
    ),
    sortValue: (r) => r.board,
  },
]

// ---- In-page navigation: single source of truth for ids + TOC labels --------
const SECTIONS = [
  { id: 'proposed', label: 'Proposed change' },
  { id: 'current-vs-proposed', label: 'Current vs. proposed' },
  { id: 'who-funds', label: 'Who pays for it' },
  { id: 'why-oregon', label: 'Why Oregon “has to”' },
  { id: 'inversion', label: 'The inversion' },
  { id: 'at-a-glance', label: 'At a glance' },
  { id: 'ten-year', label: '10-year cost to treat' },
  { id: 'regulatory-burden', label: 'Regulatory-burden axis' },
  { id: 'fee-comparison', label: 'Full fee comparison' },
  { id: 'outcomes', label: 'Outcomes evidence' },
  { id: 'cost-effectiveness', label: 'Cost-effectiveness' },
  { id: 'first-year', label: 'First-year cost' },
  { id: 'multiples', label: 'How many times more' },
  { id: 'who-pays', label: 'Who the state pays for' },
  { id: 'summary', label: 'What this shows' },
  { id: 'take-action', label: 'Take action' },
  { id: 'sources', label: 'Sources' },
]

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Sticky in-page table of contents. Renders as a fixed left rail on wide
// screens and a collapsible "Contents" toggle on narrow ones (CSS-driven).
function PageNav({ sections, activeId }) {
  const [open, setOpen] = useState(false)
  return (
    <nav className="psilo-nav" aria-label="Sections on this page">
      <button
        type="button"
        className="psilo-nav-toggle"
        aria-expanded={open}
        aria-controls="psilo-nav-list"
        onClick={() => setOpen((o) => !o)}
      >
        <span>Contents</span>
        <span className="psilo-nav-chevron" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>
      <ol
        id="psilo-nav-list"
        className={'psilo-nav-list' + (open ? ' is-open' : '')}
      >
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={'psilo-nav-link' + (s.id === activeId ? ' is-active' : '')}
              aria-current={s.id === activeId ? 'true' : undefined}
              onClick={(e) => {
                setOpen(false)
                const el = document.getElementById(s.id)
                if (!el) return
                e.preventDefault()
                el.scrollIntoView({
                  behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                  block: 'start',
                })
                if (window.history && window.history.replaceState) {
                  window.history.replaceState(null, '', `#${s.id}`)
                } else {
                  window.location.hash = s.id
                }
              }}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default function PsilocybinPage() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id)
  const pageRef = useRef(null)

  useEffect(() => {
    const prev = document.title
    document.title = 'Oregon Psilocybin Licensing Costs'
    return () => {
      document.title = prev
    }
  }, [])

  // Scroll-spy: highlight the section nearest the top of the viewport.
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return undefined
    }
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean)
    if (!els.length) return undefined

    const tops = new Map()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            tops.set(entry.target.id, entry.boundingClientRect.top)
          } else {
            tops.delete(entry.target.id)
          }
        }
        if (tops.size) {
          let best = null
          let bestTop = Infinity
          for (const [id, top] of tops) {
            if (top < bestTop) {
              bestTop = top
              best = id
            }
          }
          if (best) setActiveId(best)
        }
      },
      { rootMargin: '-12% 0px -73% 0px', threshold: 0 },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // Reveal-on-scroll: gate the hidden/animated state behind a JS class so the
  // page is fully visible with JS off or reduced motion. One-shot per section.
  // useLayoutEffect adds the class before paint so revealed content never
  // flashes visible-then-hidden.
  useLayoutEffect(() => {
    const root = pageRef.current
    if (!root) return undefined
    if (
      typeof window === 'undefined' ||
      !('IntersectionObserver' in window) ||
      prefersReducedMotion()
    ) {
      return undefined
    }
    root.classList.add('js-reveal')
    const targets = Array.from(root.querySelectorAll('[data-reveal]'))
    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            obs.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    )
    targets.forEach((el) => observer.observe(el))
    return () => {
      observer.disconnect()
      root.classList.remove('js-reveal')
    }
  }, [])

  return (
    <div className="psilo-page" ref={pageRef}>
      <PageNav sections={SECTIONS} activeId={activeId} />
      <div className="psilo-container">
        {/* ---- Header ---- */}
        <header className="psilo-header" data-reveal>
          <h1>{metadata.title}</h1>
          <p className="psilo-lede">{metadata.subtitle}</p>
          <p className="psilo-meta">
            Data as of <strong>{metadata.asOf}</strong>. {metadata.methodology}
          </p>
        </header>

        {/* ---- What just changed (news banner) ---- */}
        <section id="proposed" className="psilo-news" data-reveal aria-labelledby="proposed-h">
          <span className="psilo-news-tag">Proposed · {metadata.proposedAnnounced}</span>
          <h2 id="proposed-h">Oregon just proposed doubling psilocybin fees</h2>
          <p>
            The Oregon Health Authority proposed raising <strong>facilitator</strong> licenses from{' '}
            {currency.format(2000)} to <strong>{currency.format(4000)}/yr</strong> and{' '}
            <strong>service center</strong> licenses from {currency.format(10000)} to{' '}
            <strong>{currency.format(20000)}/yr</strong> — on a program that is already the most
            expensive health-care license in the state.
          </p>
          <p className="psilo-news-pending">
            Manufacturer, testing-lab and worker-permit fees are expected to rise as well; those
            figures aren&rsquo;t confirmed yet, so they&rsquo;re not charted here.
          </p>
        </section>

        {/* ---- Current vs proposed ---- */}
        <section id="current-vs-proposed" className="psilo-section" data-reveal>
          <h2>Current vs. proposed</h2>
          <p className="psilo-sub">
            The confirmed increases, side by side. Purple = today; red = proposed.
          </p>
          <GroupedBar
            data={proposedBars}
            refValue={traditionalAvgAnnual}
            refLabel="For scale, the average of every other mental-health license"
            ariaLabel="Current versus proposed psilocybin license fees"
          />
        </section>

        {/* ---- Who pays for the program (funding-source flip) ---- */}
        <section id="who-funds" className="psilo-section" data-reveal>
          <h2>Who pays for the program — and why that just changed</h2>
          <p className="psilo-sub">
            The fee crisis isn&rsquo;t about how much the program costs (~$3.1M/yr). It&rsquo;s about{' '}
            <strong>who covers that cost</strong>. Over three budget cycles, taxpayer (General Fund)
            support goes <strong>{millions(fundingHistory[0].generalFund)} →{' '}
            {millions(fundingHistory[1].generalFund)} → $0</strong>, while the entire load shifts
            onto license fees. Green = taxpayer dollars; purple = fees paid by licensees.
          </p>
          <StackedBar
            data={fundingBars}
            segmentColors={['var(--psilo-genfund)', 'var(--psilo-fees)']}
            ariaLabel="Oregon Psilocybin Services funding by source and biennium"
          />
          <div className="psilo-legend">
            <span>
              <i className="psilo-swatch" style={{ background: 'var(--psilo-genfund)' }} />
              Taxpayer (General Fund)
            </span>
            <span>
              <i className="psilo-swatch" style={{ background: 'var(--psilo-fees)' }} />
              License fees
            </span>
          </div>

          <div className="psilo-stats" style={{ marginTop: 22 }}>
            <div className="psilo-stat">
              <div className="num">
                {millions(fundingHistory[0].generalFund)} → {millions(fundingHistory[1].generalFund)} → $0
              </div>
              <div className="cap">Taxpayer support across 2021–23, 2023–25, 2025–27</div>
            </div>
            <div className="psilo-stat">
              <div className="num">{budgetCurrency.format(fundShift.amount)}</div>
              <div className="cap">Moved off taxpayers and onto fees for 2025–27</div>
            </div>
            <div className="psilo-stat">
              <div className="num">{millions(feeShortfall.amount)}</div>
              <div className="cap">2023–25 fee shortfall — why the General Fund had to step in</div>
            </div>
            <div className="psilo-stat">
              <div className="num">{fundingHistory[0].fte} FTE</div>
              <div className="cap">Staff who built the nation&rsquo;s first psilocybin program</div>
            </div>
          </div>

          <div className="psilo-prose" style={{ marginTop: 18 }}>
            <p>
              The taxpayer contribution was never meant to be permanent — the General Fund was
              structured to cover only about one year of the 2023–25 biennium, with the program
              expected to run entirely on fees by {transitionPlan.targetBiennium}.{' '}
              <a href={transitionPlan.source.url} target="_blank" rel="noopener noreferrer">
                ({transitionPlan.source.label})
              </a>{' '}
              But that plan assumed fee revenue would grow into the gap. Instead the licensee base
              shrank. With taxpayer support now at <strong>$0</strong> and a{' '}
              {budgetCurrency.format(fundShift.amount)} cost handed straight to licensees, the only
              lever left is the fee — which is exactly where the death spiral begins.{' '}
              <a href={fundShift.source.url} target="_blank" rel="noopener noreferrer">
                ({fundShift.source.label})
              </a>
            </p>
          </div>
        </section>

        {/* ---- Why Oregon says it has to ---- */}
        <section id="why-oregon" className="psilo-section" data-reveal>
          <h2>Why Oregon says it &ldquo;has to&rdquo;</h2>
          <p className="psilo-sub">
            It isn&rsquo;t malice — it&rsquo;s a structural trap. The program was designed to fund
            itself from fees, the taxpayer backfill has run out, and the licensee base is shrinking.
            That combination forces fees up, which shrinks the base further. A death spiral:
          </p>
          <CycleDiagram
            steps={deathSpiralSteps}
            centerLabel="Death spiral"
            ariaLabel="The psilocybin fee death spiral"
          />
          <div className="psilo-prose" style={{ marginTop: 20 }}>
            <p>
              By law the program must pay for itself out of license fees (Measure 109 sold it as
              fee-funded, not taxpayer-funded). The general fund quietly covered{' '}
              {currency.format(programFinance.generalFundPrior)} in 2023&ndash;25, but{' '}
              <strong>none is secured for 2025&ndash;27</strong> amid Oregon&rsquo;s ~$1B budget
              shortfall. Meanwhile the base is collapsing: about{' '}
              {programFinance.serviceCentersLicensed} service centers were licensed and roughly{' '}
              {programFinance.serviceCentersOpen} remain. With a fixed ~
              {currency.format(programFinance.annualCost)}/yr to cover and a reported{' '}
              {currency.format(programFinance.shortfall)} gap, the only lever left is the fee.{' '}
              <a href={programFinance.source.url} target="_blank" rel="noopener noreferrer">
                ({programFinance.source.label})
              </a>
            </p>
          </div>

          <h3 className="psilo-subhead">The cost-recovery math</h3>
          <p className="psilo-sub">{costRecovery.note}</p>
          <BarChart
            data={costRecoveryBars}
            ariaLabel="Per-licensee fee rises as the base shrinks"
          />

          <div className="psilo-prose" style={{ marginTop: 18 }}>
            {policyContext.map((c) => (
              <p key={c.id}>
                {c.text}{' '}
                <a href={c.source.url} target="_blank" rel="noopener noreferrer">
                  ({c.source.label})
                </a>
              </p>
            ))}
          </div>
        </section>

        {/* ---- Centerpiece: the inversion ---- */}
        <section id="inversion" className="psilo-section" data-reveal>
          <h2>The inversion</h2>
          <p className="psilo-sub">
            Two questions decide how Oregon treats a form of mental-health care: does the state help
            pay for it, and how much does it charge providers to be licensed? Traditional care and
            psilocybin land in opposite corners.
          </p>
          <QuadrantChart
            points={inversionPoints}
            axes={inversionAxes}
            ariaLabel="State subsidy versus licensing fee for traditional care and psilocybin"
          />
          <p className="psilo-takeaway">
            The state <strong>subsidizes the care it makes cheap to provide</strong>, and{' '}
            <strong>refuses to subsidize the care it makes the most expensive to provide.</strong>{' '}
            That diagonal is the whole story.
          </p>
        </section>

        {/* ---- Headline stats ---- */}
        <section id="at-a-glance" className="psilo-stats" data-reveal aria-labelledby="at-a-glance-h">
          <h2 id="at-a-glance-h" className="psilo-visually-hidden">
            At a glance
          </h2>
          <div className="psilo-stat">
            <div className="num">{currency.format(annualCost(facilitator))}/yr</div>
            <div className="cap">Psilocybin facilitator — the person who sits with clients</div>
          </div>
          <div className="psilo-stat">
            <div className="num">{currency.format(annualCost(serviceCenter))}/yr</div>
            <div className="cap">Psilocybin service center</div>
          </div>
          <div className="psilo-stat">
            <div className="num">{currency.format(traditionalAvgAnnual)}/yr</div>
            <div className="cap">Average of every other mental-health license</div>
          </div>
          <div className="psilo-stat">
            <div className="num">{Math.round(ratioOf(serviceCenter))}×</div>
            <div className="cap">What a service center pays vs. that average</div>
          </div>
        </section>

        {/* ---- 10-year cost to treat one patient ---- */}
        <section id="ten-year" className="psilo-section" data-reveal>
          <h2>10-year cost to treat one patient — and who pays it</h2>
          <p className="psilo-sub">
            Traditional depression care is <strong>chronic and recurring</strong> — a bill that
            repeats every year, mostly paid by the state/insurer. Psilocybin in trials is{' '}
            <strong>episodic</strong> — a few durable sessions, paid entirely out of pocket. Darker
            segment = paid by the state/insurer; lighter = paid by the patient.
          </p>
          <StackedBar
            data={lifetimeBars}
            segmentColors={['var(--psilo-recurring)', 'var(--psilo-one-time)']}
            ariaLabel="Ten-year cost to treat one patient, split by who pays"
          />
          <div className="psilo-legend">
            <span>
              <i className="psilo-swatch" style={{ background: 'var(--psilo-recurring)' }} />
              Paid by the state / insurer
            </span>
            <span>
              <i className="psilo-swatch" style={{ background: 'var(--psilo-one-time)' }} />
              Paid by the patient
            </span>
          </div>
          <details className="psilo-assumptions">
            <summary>Assumptions &amp; sources (these are illustrative estimates)</summary>
            <ul>
              <li>Time horizon: {lifetimeAssumptions.years} years.</li>
              <li>
                Psilocybin: {currency.format(lifetimeAssumptions.psilocybinSessionCost)}/session ×{' '}
                {lifetimeAssumptions.psilocybinSessionsPer10yr} sessions, 100% patient-paid (no
                insurance/Medicaid coverage). {lifetimeAssumptions.notes.psilocybinSessionCost}
              </li>
              <li>
                Traditional: {currency.format(lifetimeAssumptions.traditionalAnnualCost)}/yr ×{' '}
                {lifetimeAssumptions.years} years, {Math.round(lifetimeAssumptions.traditionalStatePaidShare * 100)}%
                state/insurer-paid. {lifetimeAssumptions.notes.traditionalAnnualCost}
              </li>
              <li>
                Treatment-resistant cases run far higher on the traditional side (e.g. TMS
                ~$67k/yr), which would widen the gap. Source:{' '}
                <a
                  href={lifetimeAssumptions.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {lifetimeAssumptions.source.label}
                </a>
                .
              </li>
            </ul>
          </details>
        </section>

        {/* ---- Main chart (regulatory-burden axis) ---- */}
        <section id="regulatory-burden" className="psilo-section" data-reveal>
          <h2>The regulatory-burden axis: annual cost to hold the license</h2>
          <p className="psilo-sub">
            Recurring license fee per year, sorted cheapest → most expensive. Purple = psilocybin.
            One-time application fees excluded (see table below).
          </p>
          <BarChart data={mainBars} ariaLabel="Annual licensing cost by profession" />
        </section>

        {/* ---- Comparison table ---- */}
        <section id="fee-comparison" className="psilo-section" data-reveal>
          <h2>Full fee comparison</h2>
          <p className="psilo-sub">Click any column header to sort. Psilocybin rows are shaded.</p>
          <SortableTable
            columns={columns}
            rows={licenses}
            rowClass={(r) => (r.category === 'psilocybin' ? 'is-psilo' : undefined)}
          />
        </section>

        {/* ---- Outcomes ---- */}
        <section id="outcomes" className="psilo-section" data-reveal>
          <h2>What the outcomes evidence shows</h2>
          <p className="psilo-sub">
            In clinical trials, psilocybin-assisted therapy is comparable-to-better and markedly
            more durable per dose than standard care — not a flat &ldquo;more effective&rdquo;
            claim, but a real one. (Oregon&rsquo;s program is non-medical supported adult use, which
            differs from the screened, therapy-supported trial model.)
          </p>
          <div className="psilo-cards">
            {outcomes.map((o) => (
              <div key={o.id} className="psilo-card">
                <div className="psilo-card-metric">{o.metric}</div>
                <div className="psilo-card-label">{o.label}</div>
                <p className="psilo-card-detail">{o.detail}</p>
                <a href={o.source.url} target="_blank" rel="noopener noreferrer">
                  {o.source.label} ↗
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Cost-effectiveness ---- */}
        <section id="cost-effectiveness" className="psilo-section psilo-prose" data-reveal>
          <h2>Cost-effectiveness</h2>
          {costEffectiveness.map((c) => (
            <p key={c.id}>
              {c.text}{' '}
              <a href={c.source.url} target="_blank" rel="noopener noreferrer">
                ({c.source.label})
              </a>
            </p>
          ))}
        </section>

        {/* ---- First-year vs ongoing ---- */}
        <section id="first-year" className="psilo-section" data-reveal>
          <h2>First-year cost: one-time vs. recurring</h2>
          <p className="psilo-sub">
            How a license-holder&rsquo;s first-year bill breaks down. For psilocybin, the recurring
            fee dwarfs everything; for traditional licenses the one-time application is a meaningful
            share.
          </p>
          <StackedBar
            data={stackBars}
            segmentColors={['var(--psilo-one-time)', 'var(--psilo-recurring)']}
            ariaLabel="First-year cost composition"
          />
          <div className="psilo-legend">
            <span>
              <i className="psilo-swatch" style={{ background: 'var(--psilo-one-time)' }} />
              One-time application / exam
            </span>
            <span>
              <i className="psilo-swatch" style={{ background: 'var(--psilo-recurring)' }} />
              First year of recurring fee
            </span>
          </div>
        </section>

        {/* ---- Ratio chart ---- */}
        <section id="multiples" className="psilo-section" data-reveal>
          <h2>How many times more expensive</h2>
          <p className="psilo-sub">
            Each psilocybin license&rsquo;s annual fee as a multiple of the{' '}
            {currency.format(traditionalAvgAnnual)}/yr average across psychiatrists, psychologists,
            counselors and social workers.
          </p>
          <RatioChart data={ratioBars} ariaLabel="Psilocybin cost as a multiple of the average" />
        </section>

        {/* ---- Who pays ---- */}
        <section id="who-pays" className="psilo-section" data-reveal>
          <h2>Who the state pays for</h2>
          <p className="psilo-sub">
            The same government that charges psilocybin the most to operate also declines to pay a
            cent toward it — while underwriting most of the cost of traditional care.
          </p>
          <div className="psilo-cards">
            {subsidy.map((s) => (
              <div
                key={s.id}
                className={
                  'psilo-card' + (s.id === 'psilo-paid' ? ' is-psilo-card' : '')
                }
              >
                <div className="psilo-card-metric">{s.who}</div>
                <div className="psilo-card-label">{s.label}</div>
                <p className="psilo-card-detail">{s.detail}</p>
                <a href={s.source.url} target="_blank" rel="noopener noreferrer">
                  {s.source.label} ↗
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Written summary ---- */}
        <section id="summary" className="psilo-section psilo-prose" data-reveal>
          <h2>What this shows</h2>
          <p>
            Oregon licenses every other mental-health profession for a few hundred dollars a year. A
            clinical social worker pays about {currency.format(annualCost(licenses.find((l) => l.id === 'lcsw')))}{' '}
            a year; a counselor about {currency.format(annualCost(licenses.find((l) => l.id === 'lpc-lmft')))}; a
            psychiatrist&rsquo;s annual registration is {currency.format(annualCost(licenses.find((l) => l.id === 'psychiatrist')))}.
            These are people who can diagnose, prescribe, and treat serious mental illness.
          </p>
          <p>
            A psilocybin facilitator — who can only support clients during a state-regulated
            session — pays <strong>{currency.format(annualCost(facilitator))} every year</strong>,
            roughly {ratioOf(facilitator).toFixed(1)}× the average traditional license. A service
            center pays <strong>{currency.format(annualCost(serviceCenter))} every year</strong> —
            about {Math.round(ratioOf(serviceCenter))}× that average — and these fees now renew{' '}
            <em>annually</em>. Because the program is required by law to fund itself entirely from
            licensing fees (it cannot draw on the general tax base the way the medical and
            psychology boards effectively can), the entire cost of standing up a brand-new
            regulatory program lands on a small number of licensees.
          </p>
          <p>
            That is the &ldquo;unfair start,&rdquo; and it has two halves. First, a{' '}
            <strong>cost-structure</strong> mismatch: traditional depression care is chronic and
            recurring — remission rates fall at each medication step and nearly half of those who
            recover relapse within a year — so the state pays for it again and again. Psilocybin in
            trials is episodic: a few durable sessions. Second, a <strong>subsidy inversion</strong>:
            the state underwrites most of the recurring treatment and licenses it cheaply, while it
            pays nothing toward psilocybin and licenses it at the highest rate in the field. A
            nascent, promising option is asked to carry every fixed program cost alone — which pushes
            service centers to close, shrinks the licensee base, and raises pressure to hike fees
            further.
          </p>

          <div className="psilo-callout">
            <strong>How to read this fairly.</strong> The efficacy figures come from{' '}
            <em>clinical trials</em>; Oregon&rsquo;s program is non-medical supported adult use, a
            different delivery model. Psilocybin is comparable-to-better and more durable per dose —
            not a settled &ldquo;more effective than everything&rdquo; verdict. It is not
            FDA-approved and remains federally Schedule I, which is <em>why</em> insurance and
            Medicaid won&rsquo;t cover it — a policy choice layered on top of Oregon&rsquo;s fee
            decisions. The 10-year cost figures are an illustrative model with the assumptions shown,
            not an official Oregon number.
          </div>

          <div className="psilo-callout">
            <strong>On the &ldquo;proposed increases.&rdquo;</strong> {metadata.proposedNote}
          </div>
        </section>

        {/* ---- Take action ---- */}
        <section id="take-action" className="psilo-cta" data-reveal aria-labelledby="take-action-h">
          <h2 id="take-action-h">{takeAction.heading}</h2>
          <p>{takeAction.body}</p>
          <div className="psilo-cta-links">
            {takeAction.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">
                {l.label} ↗
              </a>
            ))}
          </div>
        </section>

        {/* ---- Sources ---- */}
        <section id="sources" className="psilo-section" data-reveal>
          <h2>Sources</h2>
          <p className="psilo-sub">Licensing fees (official Oregon boards):</p>
          <ul className="psilo-sources">
            {licenses.map((l) => (
              <li key={l.id}>
                {l.name} — {l.board}:{' '}
                <a href={l.boardUrl} target="_blank" rel="noopener noreferrer">
                  {l.boardUrl}
                </a>
              </li>
            ))}
          </ul>
          <p className="psilo-sub" style={{ marginTop: 16 }}>
            Outcomes, cost-effectiveness &amp; subsidy:
          </p>
          <ul className="psilo-sources">
            {[...outcomes, ...costEffectiveness, ...subsidy, lifetimeAssumptions].map((item) => (
              <li key={item.id ?? item.source.url}>
                {item.source.label}:{' '}
                <a href={item.source.url} target="_blank" rel="noopener noreferrer">
                  {item.source.url}
                </a>
              </li>
            ))}
          </ul>
          <p className="psilo-sub" style={{ marginTop: 16 }}>
            Program budget &amp; funding sources (official Oregon legislative documents):
          </p>
          <ul className="psilo-sources">
            {budgetSources.map((s) => (
              <li key={s.url}>
                {s.label}:{' '}
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.url}
                </a>
              </li>
            ))}
          </ul>
          <p className="psilo-sub" style={{ marginTop: 16 }}>
            Proposed increase, program finances &amp; context:
          </p>
          <ul className="psilo-sources">
            {[
              programFinance.source,
              programFinance.shortfallSource,
              ...policyContext.map((c) => c.source),
              ...takeAction.links,
            ].map((s) => (
              <li key={s.url}>
                {s.label}:{' '}
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.url}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <footer className="psilo-footer">
          Built for personal analysis. Fees verified against official Oregon licensing board
          schedules as of {metadata.asOf}; figures change — confirm against the linked sources
          before relying on them. Annual figures annualize biennial renewals (fee ÷ 2).
        </footer>
      </div>
    </div>
  )
}
