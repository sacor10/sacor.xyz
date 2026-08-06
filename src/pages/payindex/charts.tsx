// Dependency-free, presentational chart primitives for the /pay-index page.
// Pure SVG/CSS, no charting library — the page passes in already-shaped
// data; these components hold no domain knowledge and no fetch logic.

import { useState, type ReactNode } from 'react'

const pctFmt = (x: number): string => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(2)}%`
const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

// ---- Trend line (one series, zero baseline, basket-version markers) --------
export interface TrendPoint {
  readonly period: string
  readonly value: number | null // null = no headline this period (baseline)
}

export function LineChart({ points, ariaLabel }: { points: readonly TrendPoint[]; ariaLabel: string }) {
  const values = points.map((p) => p.value).filter((v): v is number => v !== null)
  if (values.length === 0) {
    return (
      <div className="payx-chart-empty" role="img" aria-label={ariaLabel}>
        Not enough periods yet to draw a trend line.
      </div>
    )
  }

  const width = 640
  const height = 220
  const padding = 32
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1

  const usable = points
    .map((p, i) => ({ ...p, i }))
    .filter((p): p is TrendPoint & { i: number } => p.value !== null)

  const xFor = (i: number) => padding + (i / Math.max(points.length - 1, 1)) * (width - padding * 2)
  const yFor = (v: number) => height - padding - ((v - min) / span) * (height - padding * 2)
  const zeroY = yFor(0)

  const path = usable.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xFor(p.i)} ${yFor(p.value as number)}`).join(' ')

  return (
    <svg
      className="payx-linechart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} className="payx-zero-line" />
      <path d={path} className="payx-line-path" fill="none" />
      {usable.map((p) => (
        <circle key={p.period} cx={xFor(p.i)} cy={yFor(p.value as number)} r={3.5} className="payx-line-dot">
          <title>{`${p.period}: ${pctFmt(p.value as number)}`}</title>
        </circle>
      ))}
      {points.map((p, i) => (
        <text key={p.period} x={xFor(i)} y={height - 8} className="payx-axis-label" textAnchor="middle">
          {p.period}
        </text>
      ))}
    </svg>
  )
}

// ---- Diverging bar chart (signed % change from a zero center) --------------
export interface DiffBarDatum {
  readonly id: string
  readonly label: string
  readonly value: number // fraction, e.g. 0.043
  readonly note?: string
}

export function DiffBar({ data, ariaLabel }: { data: readonly DiffBarDatum[]; ariaLabel: string }) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 0.01)
  return (
    <div className="payx-diffbars" role="img" aria-label={ariaLabel}>
      {data.map((d) => {
        const pct = Math.min((Math.abs(d.value) / max) * 50, 50)
        const positive = d.value >= 0
        return (
          <div className="payx-diffbar-row" key={d.id}>
            <div className="payx-diffbar-label" title={d.label}>
              {d.label}
            </div>
            <div className="payx-diffbar-track">
              <div className="payx-diffbar-center" />
              <div
                className={`payx-diffbar-fill ${positive ? 'is-positive' : 'is-negative'}`}
                style={positive ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
              />
            </div>
            <div className="payx-diffbar-value">{pctFmt(d.value)}</div>
          </div>
        )
      })}
    </div>
  )
}

// ---- Coverage meter ----------------------------------------------------------
export function CoverageMeter({ included, total }: { included: number; total: number }) {
  const pct = total === 0 ? 0 : (included / total) * 100
  return (
    <div className="payx-coverage-meter" role="img" aria-label={`${included} of ${total} basket cells have data this period`}>
      <div className="payx-coverage-track">
        <div className="payx-coverage-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="payx-coverage-label">
        {included.toLocaleString()} / {total.toLocaleString()} cells ({pct.toFixed(1)}%)
      </div>
    </div>
  )
}

// ---- Sortable table, with a gap-row variant ---------------------------------
export interface TableColumn<Row> {
  readonly key: string
  readonly label: string
  readonly align?: 'right'
  readonly initial?: boolean | 'desc'
  readonly sortValue?: (row: Row) => string | number
  readonly render?: (row: Row) => ReactNode
}

export function SortableTable<Row extends { id: string; isGap?: boolean }>({
  columns,
  rows,
}: {
  columns: readonly TableColumn<Row>[]
  rows: readonly Row[]
}) {
  const initial = columns.find((c) => c.initial) ?? columns[0]
  const [sortKey, setSortKey] = useState(initial.key)
  const [dir, setDir] = useState<'asc' | 'desc'>(initial.initial === 'desc' ? 'desc' : 'asc')

  const col = columns.find((c) => c.key === sortKey) ?? columns[0]
  const valueOf = (row: Row) => (col.sortValue ? col.sortValue(row) : (row as Record<string, unknown>)[col.key])

  const sorted = [...rows].sort((a, b) => {
    const av = valueOf(a)
    const bv = valueOf(b)
    let cmp: number
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
    else cmp = String(av).localeCompare(String(bv))
    return dir === 'asc' ? cmp : -cmp
  })

  const onSort = (key: string) => {
    if (key === sortKey) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setDir('asc')
    }
  }

  return (
    <div className="payx-table-wrap">
      <table className="payx-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'is-right' : ''} aria-sort={c.key === sortKey ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                <button type="button" className="payx-th-btn" onClick={() => onSort(c.key)}>
                  {c.label}
                  <span className="payx-sort-caret">{c.key === sortKey ? (dir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} className={row.isGap ? 'is-gap' : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'is-right' : ''}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { pctFmt, currencyFmt }
