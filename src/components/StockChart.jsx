import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries } from 'lightweight-charts'

const CHART_OPTIONS = {
  layout: {
    background: { color: '#000000' },
    textColor: '#00FF00',
    fontFamily: 'Courier New, monospace',
  },
  grid: {
    vertLines: { color: '#003300' },
    horzLines: { color: '#003300' },
  },
  rightPriceScale: { borderColor: '#00FF00' },
  timeScale: {
    borderColor: '#00FF00',
    timeVisible: true,
    secondsVisible: false,
  },
  crosshair: { mode: 0 },
  autoSize: true,
}

const SERIES_OPTIONS = {
  upColor: '#00FF00',
  downColor: '#FF00FF',
  borderUpColor: '#00FF00',
  borderDownColor: '#FF00FF',
  wickUpColor: '#00FF00',
  wickDownColor: '#FF00FF',
}

/**
 * @param {{
 *   bars: import('../types/stocks').OhlcBar[],
 *   livePrice?: number | null,
 * }} props
 */
export default function StockChart({ bars, livePrice }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, CHART_OPTIONS)
    const series = chart.addSeries(CandlestickSeries, SERIES_OPTIONS)
    chartRef.current = chart
    seriesRef.current = series

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!seriesRef.current) return
    seriesRef.current.setData(bars)
    chartRef.current?.timeScale().fitContent()
  }, [bars])

  useEffect(() => {
    if (!seriesRef.current || livePrice == null || bars.length === 0) return
    const last = bars[bars.length - 1]
    seriesRef.current.update({
      time: last.time,
      open: last.open,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
      close: livePrice,
    })
  }, [livePrice, bars])

  return (
    <div
      ref={containerRef}
      className="stock-chart-zone"
      style={{ width: '100%', height: '360px', backgroundColor: '#000000', touchAction: 'none' }}
    />
  )
}
