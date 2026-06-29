import { useEffect } from 'react'
import './psilocybin/psilocybin.css'
import { BarChart, StackedBar, RatioChart, SortableTable } from './psilocybin/charts'
import {
  metadata,
  licenses,
  licensesByAnnualAsc,
  annualCost,
  traditionalAvgAnnual,
  currency,
} from '../data/psilocybinFees'

const periodLabel = (l) => (l.periodYears === 1 ? '/ yr' : `/ ${l.periodYears} yr`)
const ratioOf = (l) => annualCost(l) / traditionalAvgAnnual

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

export default function PsilocybinPage() {
  useEffect(() => {
    const prev = document.title
    document.title = 'Oregon Psilocybin Licensing Costs'
    return () => {
      document.title = prev
    }
  }, [])

  return (
    <div className="psilo-page">
      <div className="psilo-container">
        {/* ---- Header ---- */}
        <header className="psilo-header">
          <h1>{metadata.title}</h1>
          <p className="psilo-lede">{metadata.subtitle}</p>
          <p className="psilo-meta">
            Data as of <strong>{metadata.asOf}</strong>. {metadata.methodology}
          </p>
        </header>

        {/* ---- Headline stats ---- */}
        <div className="psilo-stats">
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
        </div>

        {/* ---- Main chart ---- */}
        <section className="psilo-section">
          <h2>Annual cost to hold the license</h2>
          <p className="psilo-sub">
            Recurring license fee per year, sorted cheapest → most expensive. Purple = psilocybin.
            One-time application fees excluded (see table below).
          </p>
          <BarChart data={mainBars} ariaLabel="Annual licensing cost by profession" />
        </section>

        {/* ---- Comparison table ---- */}
        <section className="psilo-section">
          <h2>Full fee comparison</h2>
          <p className="psilo-sub">Click any column header to sort. Psilocybin rows are shaded.</p>
          <SortableTable
            columns={columns}
            rows={licenses}
            rowClass={(r) => (r.category === 'psilocybin' ? 'is-psilo' : undefined)}
          />
        </section>

        {/* ---- First-year vs ongoing ---- */}
        <section className="psilo-section">
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
        <section className="psilo-section">
          <h2>How many times more expensive</h2>
          <p className="psilo-sub">
            Each psilocybin license&rsquo;s annual fee as a multiple of the{' '}
            {currency.format(traditionalAvgAnnual)}/yr average across psychiatrists, psychologists,
            counselors and social workers.
          </p>
          <RatioChart data={ratioBars} ariaLabel="Psilocybin cost as a multiple of the average" />
        </section>

        {/* ---- Written summary ---- */}
        <section className="psilo-section psilo-prose">
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
            That is the &ldquo;unfair start&rdquo;: a nascent field is asked to carry fixed program
            costs alone, at fee levels one to two orders of magnitude above comparable, far more
            powerful licenses — which pushes service centers to close, shrinks the licensee base,
            and raises the pressure to increase fees even further.
          </p>

          <div className="psilo-callout">
            <strong>On the &ldquo;proposed increases.&rdquo;</strong> {metadata.proposedNote}
          </div>
        </section>

        {/* ---- Sources ---- */}
        <section className="psilo-section">
          <h2>Sources</h2>
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
