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

// ---- Subsidy-inversion quadrant ---------------------------------------------
// points: [{ id, label, x, y, category, caption }]  x,y in 0..100
// axes: { x, y } label strings
export function QuadrantChart({ points, axes, ariaLabel }) {
  const W = 560
  const H = 420
  const m = { top: 18, right: 24, bottom: 56, left: 48 }
  const pw = W - m.left - m.right
  const ph = H - m.top - m.bottom
  const sx = (x) => m.left + (x / 100) * pw
  const sy = (y) => m.top + (1 - y / 100) * ph
  const midX = sx(50)
  const midY = sy(50)

  return (
    <div className="psilo-quadrant">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} width="100%">
        {/* quadrant tints: top-left = inequity, bottom-right = favored */}
        <rect x={m.left} y={m.top} width={pw / 2} height={ph / 2} fill="#fdecec" />
        <rect x={midX} y={midY} width={pw / 2} height={ph / 2} fill="#eaf6ee" />
        {/* plot border + midlines */}
        <rect
          x={m.left}
          y={m.top}
          width={pw}
          height={ph}
          fill="none"
          stroke="#d7dce3"
        />
        <line x1={midX} y1={m.top} x2={midX} y2={m.top + ph} stroke="#d7dce3" strokeDasharray="4 4" />
        <line x1={m.left} y1={midY} x2={m.left + pw} y2={midY} stroke="#d7dce3" strokeDasharray="4 4" />

        {/* points */}
        {points.map((p) => {
          const cx = sx(p.x)
          const cy = sy(p.y)
          const isPsilo = p.category === 'psilocybin'
          const color = isPsilo ? 'var(--psilo-accent)' : 'var(--psilo-neutral)'
          // keep labels inside the plot
          const anchor = p.x > 50 ? 'end' : 'start'
          const dx = p.x > 50 ? -14 : 14
          return (
            <g key={p.id}>
              <circle cx={cx} cy={cy} r="9" fill={color} />
              <text
                x={cx + dx}
                y={cy - 6}
                textAnchor={anchor}
                className="psilo-q-label"
                fill="var(--psilo-ink)"
              >
                {p.label}
              </text>
              <text
                x={cx + dx}
                y={cy + 11}
                textAnchor={anchor}
                className="psilo-q-cap"
                fill="var(--psilo-muted)"
              >
                {p.caption}
              </text>
              {p.money && (
                <text
                  x={cx + dx}
                  y={cy + 27}
                  textAnchor={anchor}
                  className="psilo-q-money"
                  fill={color}
                >
                  {p.money}
                </text>
              )}
            </g>
          )
        })}

        {/* axis labels */}
        <text x={m.left + pw / 2} y={H - 16} textAnchor="middle" className="psilo-q-axis">
          {axes.x}
        </text>
        <text
          x={-(m.top + ph / 2)}
          y={16}
          textAnchor="middle"
          transform="rotate(-90)"
          className="psilo-q-axis"
        >
          {axes.y}
        </text>
      </svg>
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
