import { useEffect, useState } from 'react'

const STORAGE_KEY = 'sacor-hit-date'
const FALLBACK = 4269

const todayUTC = () => new Date().toISOString().slice(0, 10)

export default function HitCounter() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    let cancelled = false
    const today = todayUTC()
    const alreadyCountedToday = localStorage.getItem(STORAGE_KEY) === today
    const method = alreadyCountedToday ? 'GET' : 'POST'

    fetch('/api/hit', { method })
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
      bgColor="#000000"
    >
      <tbody>
        <tr>
          <td align="center" bgColor="#00FF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ HIT COUNTER ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center" bgColor="#000000">
            <font face="Courier New" size="3" color="#00FF00">
              You are visitor #
            </font>
            <br />
            <img
              src="/placeholders/counter.svg"
              alt={display}
              width="140"
              height="30"
              border="2"
              className="inset-yellow"
            />
            <br />
            <font face="Courier New" size="2" color="#FFFF00">
              {display}
            </font>
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
