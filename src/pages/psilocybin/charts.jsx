// Dependency-free, presentational chart primitives for the /psilocybin page.
// Pure CSS/flexbox bars + a sortable HTML table. All data is passed in by the
// page; these components hold no domain knowledge.

import { useState } from 'react'

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

// ---- Horizontal bar chart ----------------------------------------------------
// data: [{ id, label, value, highlight, valueLabel? }]
export function BarChart({ data, max, ariaLabel }) {
  const top = max ?? Math.max(...data.map((d) => d.value))
  return (
    <div className="psilo-bars" role="img" aria-label={ariaLabel}>
      {data.map((d) => {
        const pct = top > 0 ? Math.max((d.value / top) * 100, 0.6) : 0
        return (
          <div className="psilo-bar-row" key={d.id}>
            <div className="psilo-bar-label" title={d.label}>
              {d.label}
            </div>
            <div className="psilo-bar-track">
              <div
                className={'psilo-bar-fill' + (d.highlight ? ' is-highlight' : '')}
                style={{ width: `${pct}%` }}
              />
              <span className="psilo-bar-value">{d.valueLabel ?? fmt.format(d.value)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---- Horizontal stacked bar chart -------------------------------------------
// data: [{ id, label, segments: [{ label, value }] }]
// segmentColors: array of CSS colors applied by segment index
export function StackedBar({ data, segmentColors, ariaLabel }) {
  const totals = data.map((d) => d.segments.reduce((s, seg) => s + seg.value, 0))
  const max = Math.max(...totals)
  return (
    <div className="psilo-stacked" role="img" aria-label={ariaLabel}>
      {data.map((d, rowIdx) => {
        const total = totals[rowIdx]
        return (
          <div className="psilo-bar-row" key={d.id}>
            <div className="psilo-bar-label" title={d.label}>
              {d.label}
            </div>
            <div className="psilo-bar-track">
              <div
                className="psilo-stack-wrap"
                style={{ width: `${max > 0 ? (total / max) * 100 : 0}%` }}
              >
                {d.segments.map((seg, i) => (
                  <div
                    key={seg.label}
                    className="psilo-stack-seg"
                    style={{
                      width: `${total > 0 ? (seg.value / total) * 100 : 0}%`,
                      background: segmentColors[i % segmentColors.length],
                    }}
                    title={`${seg.label}: ${fmt.format(seg.value)}`}
                  />
                ))}
              </div>
              <span className="psilo-bar-value">{fmt.format(total)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---- Ratio chart -------------------------------------------------------------
// data: [{ id, label, ratio, highlight }]
export function RatioChart({ data, ariaLabel }) {
  const max = Math.max(...data.map((d) => d.ratio))
  return (
    <div className="psilo-bars" role="img" aria-label={ariaLabel}>
      {data.map((d) => {
        const pct = Math.max((d.ratio / max) * 100, 1)
        return (
          <div className="psilo-bar-row" key={d.id}>
            <div className="psilo-bar-label" title={d.label}>
              {d.label}
            </div>
            <div className="psilo-bar-track">
              <div
                className={'psilo-bar-fill' + (d.highlight ? ' is-highlight' : '')}
                style={{ width: `${pct}%` }}
              />
              <span className="psilo-bar-value">
                {d.ratio >= 10 ? Math.round(d.ratio) : d.ratio.toFixed(1)}×
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---- Sortable table ----------------------------------------------------------
// columns: [{ key, label, align?, render?(row), sortValue?(row), initial? }]
// rows: array of objects; rowClass?(row) optional class hook
export function SortableTable({ columns, rows, rowClass }) {
  const initial = columns.find((c) => c.initial) ?? columns[0]
  const [sortKey, setSortKey] = useState(initial.key)
  const [dir, setDir] = useState(initial.initial === 'desc' ? 'desc' : 'asc')

  const col = columns.find((c) => c.key === sortKey) ?? columns[0]
  const valueOf = (row) => (col.sortValue ? col.sortValue(row) : row[col.key])

  const sorted = [...rows].sort((a, b) => {
    const av = valueOf(a)
    const bv = valueOf(b)
    let cmp
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
    else cmp = String(av).localeCompare(String(bv))
    return dir === 'asc' ? cmp : -cmp
  })

  const onSort = (key) => {
    if (key === sortKey) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setDir('asc')
    }
  }

  return (
    <div className="psilo-table-wrap">
      <table className="psilo-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.align === 'right' ? 'is-right' : ''}
                aria-sort={
                  c.key === sortKey ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
                }
              >
                <button type="button" className="psilo-th-btn" onClick={() => onSort(c.key)}>
                  {c.label}
                  <span className="psilo-sort-caret">
                    {c.key === sortKey ? (dir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} className={rowClass ? rowClass(row) : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'is-right' : ''}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
