import { useEffect, useRef } from 'react'

// Neon sparkle trail that follows the mouse — the classic 90s GeoCities effect.
// Renders a single fixed, click-through overlay and spawns short-lived sparkles
// on mouse movement. Disabled for touch input and prefers-reduced-motion.
const SPARKLE_COLORS = ['#FF00FF', '#00FFFF', '#FFFF00']
const SPARKLE_GLYPHS = ['✦', '✧', '★', '＊']
const SPAWN_INTERVAL_MS = 40 // throttle: at most one sparkle per interval
const MOVE_THRESHOLD_PX = 6 // and only after the pointer moves a bit
const MAX_SPARKLES = 80 // room for a full burst plus an active trail
const BURST_COUNT = 14 // sparkles flung out per click/tap
const BURST_MIN_DIST = 45
const BURST_MAX_DIST = 95

export default function CursorTrail() {
  const layerRef = useRef(null)

  useEffect(() => {
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    const layer = layerRef.current
    if (!layer) return

    let lastSpawn = 0
    let lastX = 0
    let lastY = 0
    let colorIdx = 0
    const live = new Set()

    // Shared helper: add a sparkle span to the layer, register cleanup, and
    // enforce the concurrent-sparkle cap so bursts + trail can't pile up.
    const addSparkle = (sparkle) => {
      const remove = () => {
        sparkle.remove()
        live.delete(sparkle)
      }
      sparkle.addEventListener('animationend', remove)
      layer.appendChild(sparkle)
      live.add(sparkle)

      if (live.size > MAX_SPARKLES) {
        const oldest = live.values().next().value
        if (oldest) {
          oldest.remove()
          live.delete(oldest)
        }
      }
    }

    // Neon explosion: fling a ring of sparkles outward from a click/tap point.
    const spawnBurst = (x, y) => {
      for (let i = 0; i < BURST_COUNT; i += 1) {
        const angle = (i / BURST_COUNT) * Math.PI * 2 + Math.random() * 0.5
        const dist = BURST_MIN_DIST + Math.random() * (BURST_MAX_DIST - BURST_MIN_DIST)
        const sparkle = document.createElement('span')
        sparkle.className = 'cursor-burst'
        sparkle.textContent = SPARKLE_GLYPHS[Math.floor(Math.random() * SPARKLE_GLYPHS.length)]
        sparkle.style.left = x + 'px'
        sparkle.style.top = y + 'px'
        sparkle.style.color = SPARKLE_COLORS[colorIdx % SPARKLE_COLORS.length]
        sparkle.style.setProperty('--burst-dx', Math.cos(angle) * dist + 'px')
        sparkle.style.setProperty('--burst-dy', Math.sin(angle) * dist + 'px')
        colorIdx += 1
        addSparkle(sparkle)
      }
    }

    // Fires for mouse, touch, and pen — so mobile taps explode too. We don't
    // preventDefault, so clicks on links/buttons still work normally.
    const onPointerDown = (e) => {
      spawnBurst(e.clientX, e.clientY)
    }

    const onPointerMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return

      const now = e.timeStamp || performance.now()
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      if (
        now - lastSpawn < SPAWN_INTERVAL_MS ||
        dx * dx + dy * dy < MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX
      ) {
        return
      }
      lastSpawn = now
      lastX = e.clientX
      lastY = e.clientY

      const sparkle = document.createElement('span')
      sparkle.className = 'cursor-sparkle'
      sparkle.textContent = SPARKLE_GLYPHS[Math.floor(Math.random() * SPARKLE_GLYPHS.length)]
      sparkle.style.left = e.clientX + 'px'
      sparkle.style.top = e.clientY + 'px'
      sparkle.style.color = SPARKLE_COLORS[colorIdx % SPARKLE_COLORS.length]
      colorIdx += 1

      addSparkle(sparkle)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      live.forEach((s) => s.remove())
      live.clear()
    }
  }, [])

  return <div ref={layerRef} className="cursor-trail-layer" aria-hidden="true" />
}
