import { useEffect, useRef, useState } from 'react'
import Layout from '../Layout'
import HitCounter from '../components/HitCounter'
import StockChart from '../components/StockChart'
import { useAuth } from '../auth/useAuth'

const QUICK_PICKS = ['GLD', 'GDX', 'BTC-USD', 'NVDA']
const MAX_PINNED_SYMBOLS = 20
const POLL_MS = 3000
const SYMBOL_RE = /^[A-Z.-]{1,8}$/

const formatPrice = (n) =>
  typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '--'

const formatChange = (price, pct) => {
  if (typeof price !== 'number' || typeof pct !== 'number') return '--'
  const sign = price >= 0 ? '+' : ''
  return `${sign}${price.toFixed(2)} (${sign}${pct.toFixed(2)}%)`
}

const formatTime = (ts) => {
  if (!ts) return '--'
  return new Date(ts * 1000).toLocaleTimeString()
}

const normalizePinnedSymbols = (items) => {
  const symbols = []
  for (const item of Array.isArray(items) ? items : []) {
    const next = String(item ?? '').trim().toUpperCase()
    if (!SYMBOL_RE.test(next) || symbols.includes(next)) continue
    symbols.push(next)
    if (symbols.length >= MAX_PINNED_SYMBOLS) break
  }
  return symbols
}

function Sidebar() {
  return (
    <>
      <table
        width="100%"
        cellPadding="8"
        cellSpacing="0"
        border="0"
        className="bevelbox"
        bgcolor="#000080"
      >
        <tbody>
          <tr>
            <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">
                ~ MARKET HOURS ~
              </font>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#00FFFF">
                <b className="yellow">NYSE</b>
                <br />
                <b className="lime">09:30 &ndash; 16:00 ET</b>
                <br />
                Mon &ndash; Fri
                <br />
                <br />
                <font color="#FF00FF">After hours quotes may be stale!</font>
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <HitCounter />

      <br />

      <table
        width="100%"
        cellPadding="8"
        cellSpacing="0"
        border="0"
        className="bevelbox"
        bgcolor="#4B0082"
      >
        <tbody>
          <tr>
            <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
              <font face="Impact" size="4" color="#FFFF00">
                ~ DISCLAIMER ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <marquee behavior="scroll" direction="left" scrollamount="4">
                <font face="Impact" size="3" color="#FFFF00">
                  &#9888; NOT FINANCIAL ADVICE &#9888; DATA MAY BE DELAYED &#9888; FOR ENTERTAINMENT ONLY &#9888;
                </font>
              </marquee>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

export default function StocksPage() {
  const { loading: authLoading, isSignedIn } = useAuth()
  const [symbol, setSymbol] = useState('GLD')
  const [input, setInput] = useState('GLD')
  const [pinnedSymbols, setPinnedSymbols] = useState(QUICK_PICKS)
  const [pinsError, setPinsError] = useState('')
  const [pinsSaving, setPinsSaving] = useState(false)
  const [history, setHistory] = useState({ symbol: null, bars: [], status: 'loading' })
  const [quoteData, setQuoteData] = useState({ symbol: null, quote: null, error: null })
  const pollRef = useRef(null)

  useEffect(() => {
    if (authLoading) return
    if (!isSignedIn) return

    let cancelled = false
    fetch('/.netlify/functions/stocks-pins', { credentials: 'same-origin' })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(body?.error || `pins ${r.status}`)
        return body
      })
      .then((data) => {
        if (cancelled) return
        const symbols = normalizePinnedSymbols(data?.symbols)
        setPinnedSymbols(symbols.length > 0 ? symbols : QUICK_PICKS)
        setPinsError('')
      })
      .catch(() => {
        if (cancelled) return
        setPinnedSymbols((current) => (current.length > 0 ? current : QUICK_PICKS))
        setPinsError('Could not load saved pins. Using defaults for now.')
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, isSignedIn])

  useEffect(() => {
    let cancelled = false
    fetch(`/.netlify/functions/stocks-history?symbol=${encodeURIComponent(symbol)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`history ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        setHistory({ symbol, bars: data.bars ?? [], status: 'ready' })
      })
      .catch(() => {
        if (cancelled) return
        setHistory({ symbol, bars: [], status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [symbol])

  useEffect(() => {
    let cancelled = false

    const fetchQuote = () => {
      if (document.visibilityState !== 'visible') return
      fetch(`/.netlify/functions/stocks-quote?symbol=${encodeURIComponent(symbol)}`)
        .then(async (r) => {
          const body = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(body?.error || `quote ${r.status}`)
          return body
        })
        .then((data) => {
          if (cancelled) return
          setQuoteData({ symbol, quote: data, error: null })
        })
        .catch((err) => {
          if (cancelled) return
          setQuoteData({ symbol, quote: null, error: err.message || 'quote failed' })
        })
    }

    fetchQuote()
    pollRef.current = setInterval(fetchQuote, POLL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchQuote()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [symbol])

  const historyState = history.symbol === symbol ? history.status : 'loading'
  const bars = history.symbol === symbol ? history.bars : []
  const quote = quoteData.symbol === symbol ? quoteData.quote : null
  const quoteError = quoteData.symbol === symbol ? quoteData.error : null
  const quickPicks = isSignedIn ? pinnedSymbols : QUICK_PICKS
  const quickPickRows = []
  for (let i = 0; i < quickPicks.length; i += 4) {
    quickPickRows.push(quickPicks.slice(i, i + 4))
  }

  const savePinnedSymbols = async (items) => {
    const symbols = normalizePinnedSymbols(items)
    if (symbols.length === 0) {
      setPinsError('Keep at least one pinned stock.')
      return
    }

    setPinnedSymbols(symbols)
    if (!isSignedIn) return

    setPinsSaving(true)
    setPinsError('')
    try {
      const res = await fetch('/.netlify/functions/stocks-pins', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ symbols }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`)
      const saved = normalizePinnedSymbols(data?.symbols)
      setPinnedSymbols(saved.length > 0 ? saved : symbols)
      setPinsError('')
    } catch (err) {
      setPinsError(err.message || 'Could not save pins. Your changes are still shown here.')
    } finally {
      setPinsSaving(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    const next = input.trim().toUpperCase()
    if (!SYMBOL_RE.test(next)) return
    setInput(next)
    setSymbol(next)
  }

  const pickSymbol = (s) => {
    setInput(s)
    setSymbol(s)
  }

  const pinCurrentSymbol = () => {
    const next = symbol.trim().toUpperCase()
    if (pinnedSymbols.includes(next)) {
      setPinsError(`${next} is already pinned.`)
      return
    }
    if (pinnedSymbols.length >= MAX_PINNED_SYMBOLS) {
      setPinsError(`You can pin up to ${MAX_PINNED_SYMBOLS} stocks.`)
      return
    }
    savePinnedSymbols([...pinnedSymbols, next])
  }

  const removePinnedSymbol = (s) => {
    if (pinnedSymbols.length <= 1) {
      setPinsError('Keep at least one pinned stock.')
      return
    }
    savePinnedSymbols(pinnedSymbols.filter((item) => item !== s))
  }

  const movePinnedSymbol = (index, direction) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= pinnedSymbols.length) return
    const next = [...pinnedSymbols]
    const current = next[index]
    next[index] = next[nextIndex]
    next[nextIndex] = current
    savePinnedSymbols(next)
  }

  const changePositive = (quote?.change ?? 0) >= 0
  const changeColor = changePositive ? '#00FF00' : '#FF00FF'
  const changeArrow = changePositive ? '▲' : '▼'

  const mainContent = (
    <>
      <center>
        <font face="Impact" size="6" color="#00FFFF" className="hero-glow">
          ~*~ LIVE STOCKS ~*~
        </font>
      </center>

      <br />

      <font face="Comic Sans MS" size="3" color="#FFFFFF">
        <font color="#FFFF00">&#9733;</font> Real-time-ish stock quotes pumped fresh
        from the wires. Pick a ticker below or punch in your own. Charts update every{' '}
        <b className="cyan">3 seconds</b> while the market is open.{' '}
        <font color="#FFFF00">&#9733;</font>
      </font>

      <br />
      <br />

      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td align="center" bgcolor="#FF00FF" className="section-bar">
                <font face="Impact" size="5" color="#FFFF00">
                  ~ TICKER ~
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
        <tbody>
          <tr>
            <td align="center" bgcolor="#000000">
              <form onSubmit={submit}>
                <font face="Courier New" size="3" color="#00FF00">
                  SYMBOL:&nbsp;
                </font>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value.toUpperCase())}
                  maxLength={8}
                  size={8}
                  style={{
                    fontFamily: 'Courier New, monospace',
                    fontSize: '16px',
                    background: '#000',
                    color: '#00FF00',
                    border: '2px inset #00FF00',
                    padding: '2px 6px',
                    textTransform: 'uppercase',
                  }}
                />
                &nbsp;
                <button
                  type="submit"
                  className="navbtn-link"
                  style={{ cursor: 'pointer' }}
                >
                  &#9733; GO &#9733;
                </button>
                {isSignedIn && (
                  <>
                    &nbsp;
                    <button
                      type="button"
                      className="navbtn-link"
                      style={{ cursor: pinsSaving ? 'wait' : 'pointer' }}
                      disabled={pinsSaving}
                      onClick={pinCurrentSymbol}
                    >
                      &#9733; PIN {symbol} &#9733;
                    </button>
                  </>
                )}
              </form>
              <br />
              <font face="Comic Sans MS" size="2" color="#FFFFFF">
                {isSignedIn ? 'Pinned stocks:' : 'Quick picks:'}
              </font>
              <br />
              <table cellPadding="0" cellSpacing="6" border="0">
                <tbody>
                  {quickPickRows.map((row, rowIndex) => (
                    <tr key={row.join('|')}>
                      {row.map((s, rowSymbolIndex) => {
                        const i = rowIndex * 4 + rowSymbolIndex
                        return (
                          <td key={s} className="navbtn">
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                pickSymbol(s)
                              }}
                            >
                              &#9733; {s} &#9733;
                            </a>
                            {isSignedIn && (
                              <>
                                <br />
                                <button
                                  type="button"
                                  className="navbtn-link"
                                  style={{
                                    cursor: pinsSaving || i === 0 ? 'default' : 'pointer',
                                    padding: '2px 6px',
                                  }}
                                  disabled={pinsSaving || i === 0}
                                  onClick={() => movePinnedSymbol(i, -1)}
                                >
                                  &#9664;
                                </button>
                                &nbsp;
                                <button
                                  type="button"
                                  className="navbtn-link"
                                  style={{
                                    cursor: pinsSaving || pinnedSymbols.length <= 1 ? 'default' : 'pointer',
                                    padding: '2px 6px',
                                  }}
                                  disabled={pinsSaving || pinnedSymbols.length <= 1}
                                  onClick={() => removePinnedSymbol(s)}
                                >
                                  &#10005;
                                </button>
                                &nbsp;
                                <button
                                  type="button"
                                  className="navbtn-link"
                                  style={{
                                    cursor: pinsSaving || i === pinnedSymbols.length - 1 ? 'default' : 'pointer',
                                    padding: '2px 6px',
                                  }}
                                  disabled={pinsSaving || i === pinnedSymbols.length - 1}
                                  onClick={() => movePinnedSymbol(i, 1)}
                                >
                                  &#9654;
                                </button>
                              </>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {isSignedIn && (pinsError || pinsSaving) && (
                <>
                  <br />
                  <font face="Comic Sans MS" size="2" color={pinsError ? '#FF00FF' : '#00FFFF'}>
                    {pinsError || 'Saving pinned stocks...'}
                  </font>
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td align="center" bgcolor="#00FFFF" className="section-bar">
                <font face="Impact" size="5" color="#000000">
                  ~ {symbol} QUOTE ~
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      <table width="100%" cellPadding="12" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
        <tbody>
          <tr>
            <td align="center" bgcolor="#000000">
              {quoteError ? (
                <font face="Impact" size="4" color="#FF0000">
                  &#9888; QUOTE ERROR: {quoteError} &#9888;
                </font>
              ) : quote ? (
                <>
                  <font face="Courier New" size="6" color="#00FF00">
                    <b>${formatPrice(quote.price)}</b>
                  </font>
                  <br />
                  <font face="Courier New" size="4" color={changeColor}>
                    {changeArrow} {formatChange(quote.change, quote.changePct)}
                  </font>
                  <br />
                  <br />
                  <font face="Comic Sans MS" size="2" color="#FFFF00">
                    Last updated: <b>{formatTime(quote.ts)}</b>
                  </font>
                </>
              ) : (
                <font face="Impact" size="4" color="#00FFFF">
                  <span className="blink">~ LOADING QUOTE ~</span>
                </font>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td align="center" bgcolor="#FFFF00" className="section-bar">
                <font face="Impact" size="5" color="#000000">
                  ~ HOURLY CANDLES ~
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
        <tbody>
          <tr>
            <td bgcolor="#000000">
              {historyState === 'loading' && (
                <center>
                  <font face="Impact" size="4" color="#00FFFF">
                    <span className="blink">~ LOADING CHART ~</span>
                  </font>
                </center>
              )}
              {historyState === 'error' && (
                <center>
                  <font face="Impact" size="4" color="#FF0000">
                    &#9888; FAILED TO LOAD HISTORY FOR {symbol} &#9888;
                  </font>
                </center>
              )}
              {historyState === 'ready' && bars.length === 0 && (
                <center>
                  <font face="Impact" size="4" color="#FF00FF">
                    NO BARS RETURNED FOR {symbol}
                  </font>
                </center>
              )}
              {historyState === 'ready' && bars.length > 0 && (
                <StockChart bars={bars} livePrice={quote?.price ?? null} />
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <center>
        <font face="Comic Sans MS" size="2" color="#888888">
          History via Yahoo Finance &nbsp;&#9733;&nbsp; Live quotes via Finnhub
        </font>
      </center>

      <br />
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={<Sidebar />} />
}
