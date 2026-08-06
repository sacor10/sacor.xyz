import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import './payindex/payindex.css'
import { LineChart, DiffBar, CoverageMeter, SortableTable, pctFmt, currencyFmt, type TrendPoint, type TableColumn } from './payindex/charts'

// ---- API response shapes (mirrors netlify/functions/pay-index-*.mts) -------

interface CurrentBaselineOnly {
  status: 'baseline_only'
  baselinePeriod: string | null
  basketVersion: string
  methodologyVersion: string
  formula: string
  message: string
}

interface CityBreakdownEntry {
  cityId: string
  mean: number
  median: number
  cellsIncluded: number
  cellsMissing: number
}

interface Attribution {
  sourceId: string
  name: string
  attributionText: string
  homepageUrl: string
}

interface CurrentOk {
  status: 'ok'
  period: string
  baselinePeriod: string
  headline: { metric: 'mean'; pctChange: number; display: string }
  mean: number
  median: number
  coverage: { cellsTotal: number; cellsIncluded: number; cellsMissing: number; pctCovered: number; gapReasons: Record<string, number> }
  basketVersion: string
  methodologyVersion: string
  formula: string
  minObservations: number
  annualizationHours: number
  computedAt: string
  cityBreakdown: CityBreakdownEntry[]
  attributions: Attribution[]
}

type CurrentResponse = CurrentBaselineOnly | CurrentOk

interface HistorySnapshot {
  period: string
  baselinePeriod: string
  mean: number
  median: number
  cellsIncluded: number
  cellsMissing: number
  cellsTotal: number
}

interface BasketJobEntry {
  id: string
  title: string
  category: string
}
interface BasketCityEntry {
  id: string
  name: string
  region: string
}
interface BasketSourceEntry {
  id: string
  name: string
  kind: string
  tier: string
  licenseNote: string
  attributionRequired: boolean
  attributionText: string
  homepageUrl: string
}
interface ChangelogEntry {
  effectiveDate: string
  basketVersion: string
  methodologyVersion: string
  changeType: string
  detail: string
}
interface BasketResponse {
  basketVersion: string
  methodologyVersion: string
  formula: string
  minObservations: number
  annualizationHours: number
  jobs: BasketJobEntry[]
  cities: BasketCityEntry[]
  sources: BasketSourceEntry[]
  changelog: ChangelogEntry[]
}

interface CellRow {
  jobId: string
  job: string
  cityId: string
  city: string
  status: string
  medianAnnualPay: number | null
  observationCount: number
  sourceIds: string[]
}

interface AdapterHealthEntry {
  adapterId: string
  status: string
  rowsReturned: number
}

type Loadable<T> = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'loaded'; data: T }

function useJson<T>(url: string): Loadable<T> {
  const [state, setState] = useState<Loadable<T>>({ kind: 'loading' })
  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    fetch(url, { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        return res.json() as Promise<T>
      })
      .then((data) => {
        if (!cancelled) setState({ kind: 'loaded', data })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to load' })
      })
    return () => {
      cancelled = true
    }
  }, [url])
  return state
}

type Tab = 'overview' | 'cells' | 'methodology' | 'changelog'

export default function PayIndexPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const current = useJson<CurrentResponse>('/.netlify/functions/pay-index-current')
  const history = useJson<{ snapshots: HistorySnapshot[] }>('/.netlify/functions/pay-index-history')
  const basket = useJson<BasketResponse>('/.netlify/functions/pay-index-basket')
  const [cellCity, setCellCity] = useState<string>('')
  const cellsUrl = cellCity
    ? `/.netlify/functions/pay-index-cells?city=${encodeURIComponent(cellCity)}`
    : '/.netlify/functions/pay-index-cells'
  const cells = useJson<{ period: string | null; cells: CellRow[] }>(cellsUrl)
  const coverage = useJson<{ period: string | null; adapterHealth: AdapterHealthEntry[]; brokenAdapters: string[]; stale: boolean }>(
    '/.netlify/functions/pay-index-coverage',
  )

  const trendPoints: TrendPoint[] = useMemo(() => {
    if (history.kind !== 'loaded') return []
    return history.data.snapshots.map((s) => ({ period: s.period, value: s.mean }))
  }, [history])

  const cityBarData = useMemo(() => {
    if (current.kind !== 'loaded' || current.data.status !== 'ok' || basket.kind !== 'loaded') return []
    const nameById = new Map(basket.data.cities.map((c) => [c.id, c.name]))
    return [...current.data.cityBreakdown]
      .sort((a, b) => b.mean - a.mean)
      .map((c) => ({ id: c.cityId, label: nameById.get(c.cityId) ?? c.cityId, value: c.mean }))
  }, [current, basket])

  return (
    <div className="payx-page">
      <div className="payx-container">
        <Link to="/" className="payx-back-link">
          ← sacor.xyz
        </Link>

        <header className="payx-header">
          <h1>The Pay Index</h1>
          <p className="payx-lede">
            A fixed-basket, unadjusted wage-change tracker — the pay analog of the Chapwood Index. Same job titles, same
            cities, same method, every period. No quality adjustment, no substitution, no reweighting, no seasonal
            adjustment, and no government data anywhere in the pipeline.
          </p>
          <nav className="payx-nav" aria-label="Pay Index sections">
            {(
              [
                ['overview', 'Overview'],
                ['cells', 'Transparency Table'],
                ['methodology', 'Methodology'],
                ['changelog', 'Changelog'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} type="button" className={`payx-nav-btn${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>
        </header>

        {tab === 'overview' && (
          <>
            {coverage.kind === 'loaded' && coverage.data.stale && (
              <div className="payx-stale-banner">
                ⚠ One or more data sources returned no data or errored this period ({coverage.data.brokenAdapters.join(', ')}). See
                Methodology for how gaps are handled — they are excluded from the calculation and counted, never filled in.
              </div>
            )}

            <section className="payx-section" aria-labelledby="headline-h">
              <h2 id="headline-h">Headline</h2>
              {current.kind === 'loading' && <p className="payx-loading">Loading…</p>}
              {current.kind === 'error' && <p className="payx-error">Couldn't load the headline: {current.message}</p>}
              {current.kind === 'loaded' && current.data.status === 'baseline_only' && (
                <div className="payx-baseline-notice">
                  <strong>No headline yet.</strong> {current.data.message} A fixed-basket index measures change against a
                  baseline — it cannot show one until a second period exists.
                </div>
              )}
              {current.kind === 'loaded' && current.data.status === 'ok' && (
                <>
                  <div className="payx-headline-card">
                    <div className="payx-headline-figure">
                      <div className="payx-headline-metric-label">Mean — headline, {current.data.period} vs {current.data.baselinePeriod}</div>
                      <div className={`payx-headline-value ${current.data.mean >= 0 ? 'is-positive' : 'is-negative'}`}>
                        {pctFmt(current.data.mean)}
                      </div>
                      <div className="payx-headline-sub">Simple unweighted average of every basket cell's % change.</div>
                    </div>
                    <div className="payx-median-chip">
                      Median (for comparison): <strong>{pctFmt(current.data.median)}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: 20 }}>
                    <CoverageMeter included={current.data.coverage.cellsIncluded} total={current.data.coverage.cellsTotal} />
                    <div className="payx-gap-reasons">
                      {Object.entries(current.data.coverage.gapReasons).map(([reason, count]) => (
                        <span key={reason}>
                          {reason.replace(/_/g, ' ')}: {count}
                        </span>
                      ))}
                    </div>
                  </div>

                  {current.data.attributions.length > 0 && (
                    <p className="payx-attribution-list">
                      {current.data.attributions.map((a) => (
                        <span key={a.sourceId}>
                          {a.attributionText}
                          {'. '}
                        </span>
                      ))}
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="payx-section" aria-labelledby="trend-h">
              <h2 id="trend-h">Trend</h2>
              {history.kind === 'loading' && <p className="payx-loading">Loading…</p>}
              {history.kind === 'error' && <p className="payx-error">Couldn't load history: {history.message}</p>}
              {history.kind === 'loaded' && <LineChart points={trendPoints} ariaLabel="Pay Index mean % change by period" />}
            </section>

            <section className="payx-section" aria-labelledby="city-h">
              <h2 id="city-h">Per-city breakdown</h2>
              {current.kind === 'loaded' && current.data.status === 'ok' && cityBarData.length > 0 && (
                <DiffBar data={cityBarData} ariaLabel="Mean % change by city" />
              )}
              {current.kind === 'loaded' && current.data.status !== 'ok' && (
                <p className="payx-loading">No per-city breakdown until a headline exists.</p>
              )}
            </section>
          </>
        )}

        {tab === 'cells' && (
          <section className="payx-section" aria-labelledby="cells-h">
            <h2 id="cells-h">Full transparency table</h2>
            <p className="payx-lede">
              Every basket cell for the current period, gaps included — a gap is a row, never an omission.
            </p>
            <div className="payx-filters">
              <label>
                City:{' '}
                <select value={cellCity} onChange={(e) => setCellCity(e.target.value)}>
                  <option value="">All cities</option>
                  {basket.kind === 'loaded' &&
                    basket.data.cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {cells.kind === 'loading' && <p className="payx-loading">Loading…</p>}
            {cells.kind === 'error' && <p className="payx-error">Couldn't load cells: {cells.message}</p>}
            {cells.kind === 'loaded' && (
              <SortableTable<CellRow & { id: string; isGap: boolean }>
                columns={cellsColumns}
                rows={cells.data.cells.map((c) => ({ ...c, id: `${c.jobId}::${c.cityId}`, isGap: c.status !== 'included' }))}
              />
            )}
          </section>
        )}

        {tab === 'methodology' && (
          <section className="payx-section" aria-labelledby="methodology-h">
            <h2 id="methodology-h">Methodology</h2>
            {basket.kind === 'loading' && <p className="payx-loading">Loading…</p>}
            {basket.kind === 'error' && <p className="payx-error">Couldn't load methodology: {basket.message}</p>}
            {basket.kind === 'loaded' && (
              <>
                <p>{basket.data.formula}</p>
                <ul className="payx-rule-list">
                  <li>Fixed basket, changed only via a dated, versioned changelog entry — never silently.</li>
                  <li>Raw nominal pay only. No inflation, hedonic, or seasonal adjustment, ever.</li>
                  <li>Headline is the simple, unweighted mean of every included cell's % change. Median shown for comparison, never the headline.</li>
                  <li>
                    A cell needs at least {basket.data.minObservations} observations to be included; below that it is an
                    explicit gap, excluded from the calculation and counted.
                  </li>
                  <li>Hourly pay is annualized at {basket.data.annualizationHours} hours/year; the raw original is always kept alongside it.</li>
                  <li>No government data sources anywhere in the pipeline.</li>
                  <li>Raw observations are immutable — corrections are new rows, never overwrites.</li>
                  <li>Already-averaged figures (e.g. Levels.fyi) are shown for context but never enter the headline calculation.</li>
                  <li>A source returning zero rows for a period is an alert, never a silent no-op.</li>
                </ul>

                <h3>Basket</h3>
                <p>
                  Version {basket.data.basketVersion}, methodology {basket.data.methodologyVersion} — {basket.data.jobs.length}{' '}
                  job titles across {new Set(basket.data.jobs.map((j) => j.category)).size} categories x {basket.data.cities.length}{' '}
                  metros.
                </p>

                <h3>Sources</h3>
                <table className="payx-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Tier</th>
                      <th>Kind</th>
                      <th>License</th>
                    </tr>
                  </thead>
                  <tbody>
                    {basket.data.sources.map((s) => (
                      <tr key={s.id}>
                        <td>{s.homepageUrl ? <a href={s.homepageUrl}>{s.name}</a> : s.name}</td>
                        <td>{s.tier}</td>
                        <td>{s.kind}</td>
                        <td>{s.licenseNote}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {coverage.kind === 'loaded' && (
                  <>
                    <h3>Source health, current period</h3>
                    <table className="payx-table">
                      <thead>
                        <tr>
                          <th>Adapter</th>
                          <th>Status</th>
                          <th className="is-right">Rows returned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverage.data.adapterHealth.map((a) => (
                          <tr key={a.adapterId}>
                            <td>{a.adapterId}</td>
                            <td>{a.status}</td>
                            <td className="is-right">{a.rowsReturned}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </section>
        )}

        {tab === 'changelog' && (
          <section className="payx-section" aria-labelledby="changelog-h">
            <h2 id="changelog-h">Basket changelog</h2>
            {basket.kind === 'loading' && <p className="payx-loading">Loading…</p>}
            {basket.kind === 'error' && <p className="payx-error">Couldn't load the changelog: {basket.message}</p>}
            {basket.kind === 'loaded' &&
              basket.data.changelog.map((entry, i) => (
                <div className="payx-changelog-entry" key={i}>
                  <div className="payx-changelog-date">
                    {entry.effectiveDate} · basket {entry.basketVersion} · {entry.changeType.replace(/_/g, ' ')}
                  </div>
                  <div>{entry.detail}</div>
                </div>
              ))}
          </section>
        )}
      </div>
    </div>
  )
}

const cellsColumns: TableColumn<CellRow & { id: string; isGap: boolean }>[] = [
  { key: 'job', label: 'Job', initial: true },
  { key: 'city', label: 'City' },
  { key: 'status', label: 'Status' },
  {
    key: 'medianAnnualPay',
    label: 'Median annual pay',
    align: 'right',
    sortValue: (r) => r.medianAnnualPay ?? -1,
    render: (r) => (r.medianAnnualPay === null ? '—' : currencyFmt.format(r.medianAnnualPay)),
  },
  { key: 'observationCount', label: 'Observations', align: 'right' },
  { key: 'sourceIds', label: 'Sources', render: (r) => r.sourceIds.join(', ') || '—' },
]
