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

// ---- Grouped bar chart (current vs proposed) --------------------------------
// data: [{ id, label, current, proposed }]
export function GroupedBar({ data, ariaLabel, refValue, refLabel }) {
  const max = Math.max(...data.flatMap((d) => [d.current, d.proposed]), refValue ?? 0)
  const pct = (v) => (max > 0 ? Math.max((v / max) * 100, 0.6) : 0)
  return (
    <div className="psilo-grouped" role="img" aria-label={ariaLabel}>
      {data.map((d) => (
        <div className="psilo-group-row" key={d.id}>
          <div className="psilo-bar-label" title={d.label}>
            {d.label}
          </div>
          <div className="psilo-group-bars">
            <div className="psilo-bar-track">
              <div className="psilo-bar-fill is-highlight" style={{ width: `${pct(d.current)}%` }} />
              <span className="psilo-bar-value">{fmt.format(d.current)} now</span>
            </div>
            <div className="psilo-bar-track">
              <div className="psilo-bar-fill is-proposed" style={{ width: `${pct(d.proposed)}%` }} />
              <span className="psilo-bar-value">{fmt.format(d.proposed)} proposed</span>
            </div>
          </div>
        </div>
      ))}
      {refValue != null && (
        <div className="psilo-group-ref">
          {refLabel}: <strong>{fmt.format(refValue)}</strong>
        </div>
      )}
    </div>
  )
}

// ---- Cycle / death-spiral diagram -------------------------------------------
// steps: ordered array of short strings; arrows flow clockwise and loop back.
export function CycleDiagram({ steps, centerLabel, ariaLabel }) {
  const W = 800
  const H = 660
  const cx = W / 2
  const cy = H / 2
  const R = 240
  const n = steps.length
  const nodeW = 176
  const nodeH = 76
  const toRad = (deg) => (deg * Math.PI) / 180
  const angleAt = (i) => -90 + i * (360 / n)

  return (
    <div className="psilo-cycle">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} width="100%">
        {/* ring */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e6c9c9" strokeWidth="2" strokeDasharray="2 6" />

        {/* clockwise arrowheads in the gaps between nodes */}
        {steps.map((_, i) => {
          const mid = toRad(angleAt(i) + 360 / n / 2)
          const px = cx + R * Math.cos(mid)
          const py = cy + R * Math.sin(mid)
          const tangent = (mid * 180) / Math.PI + 90 // clockwise direction
          return (
            <path
              key={`arr-${i}`}
              d="M -7 -6 L 7 0 L -7 6 Z"
              fill="var(--psilo-accent)"
              transform={`translate(${px} ${py}) rotate(${tangent})`}
            />
          )
        })}

        {/* center label */}
        <text x={cx} y={cy - 8} textAnchor="middle" className="psilo-cycle-center">
          {centerLabel}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="psilo-cycle-center-sub">
          fees up → closures → fewer payers → fees up
        </text>

        {/* nodes */}
        {steps.map((step, i) => {
          const a = toRad(angleAt(i))
          const nx = cx + R * Math.cos(a)
          const ny = cy + R * Math.sin(a)
          return (
            <foreignObject
              key={`node-${i}`}
              x={nx - nodeW / 2}
              y={ny - nodeH / 2}
              width={nodeW}
              height={nodeH}
            >
              <div className="psilo-cycle-node">{step}</div>
            </foreignObject>
          )
        })}

        {/* numbered badges — rendered as pure SVG (after nodes) so the
            foreignObject can't clip them */}
        {steps.map((_, i) => {
          const a = toRad(angleAt(i))
          const bx = cx + R * Math.cos(a) - nodeW / 2
          const by = cy + R * Math.sin(a) - nodeH / 2
          return (
            <g key={`badge-${i}`}>
              <circle cx={bx} cy={by} r="11" fill="var(--psilo-accent)" />
              <text x={bx} y={by} className="psilo-cycle-badge">
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>
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
