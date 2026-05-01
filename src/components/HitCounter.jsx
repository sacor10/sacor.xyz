import { useEffect, useState } from 'react'

const STORAGE_KEY = 'sacor-hit-date'
const FALLBACK = 0

const todayUTC = () => new Date().toISOString().slice(0, 10)

export default function HitCounter() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    let cancelled = false
    const today = todayUTC()
    const alreadyCountedToday = localStorage.getItem(STORAGE_KEY) === today
    const method = alreadyCountedToday ? 'GET' : 'POST'

    fetch('/.netlify/functions/hit', { method })
      .then((r) => r.json())
      .then(({ count }) => {
        if (cancelled) return
        setCount(count)
        if (!alreadyCountedToday) localStorage.setItem(STORAGE_KEY, today)
      })
      .catch(() => {
        if (!cancelled) setCount(FALLBACK)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const display = String(count ?? FALLBACK).padStart(8, '0')

  return (
    <table
      width="100%"
      cellPadding="8"
      cellSpacing="0"
      border="0"
      className="bevelbox"
      bgcolor="#000000"
    >
      <tbody>
        <tr>
          <td align="center" bgcolor="#00FF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ HIT COUNTER ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center" bgcolor="#000000">
            <font face="Courier New" size="3" color="#00FF00">
              You are visitor #
            </font>
            <br />
            <svg
              width="140"
              height="30"
              viewBox="0 0 140 30"
              className="inset-yellow"
              style={{ borderWidth: '2px' }}
              role="img"
              aria-label={`visitor number ${display}`}
            >
              <rect width="140" height="30" fill="#000" />
              <rect
                x="2"
                y="2"
                width="136"
                height="26"
                fill="#001100"
                stroke="#00FF00"
                strokeWidth="1"
              />
              <g
                fontFamily="Courier New, monospace"
                fontSize="20"
                fontWeight="bold"
                textAnchor="middle"
              >
                {display.split('').map((digit, i) => {
                  const x = 14 + i * 16
                  return (
                    <g key={i}>
                      <text x={x} y="22" fill="#003300">8</text>
                      <text x={x} y="22" fill="#00FF00">{digit}</text>
                    </g>
                  )
                })}
              </g>
            </svg>
            <br />
            <font face="Comic Sans MS" size="1" color="#FFFFFF">
              since July 4, 1776
            </font>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
