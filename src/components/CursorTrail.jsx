import { useEffect, useRef } from 'react'

// Neon sparkle trail that follows the mouse — the classic 90s GeoCities effect.
// Renders a single fixed, click-through overlay and spawns short-lived sparkles
// on mouse movement. Disabled for touch input and prefers-reduced-motion.
const SPARKLE_COLORS = ['#FF00FF', '#00FFFF', '#FFFF00']
const SPARKLE_GLYPHS = ['✦', '✧', '★', '＊']
const SPAWN_INTERVAL_MS = 40 // throttle: at most one sparkle per interval
const MOVE_THRESHOLD_PX = 6 // and only after the pointer moves a bit
const MAX_SPARKLES = 40

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

      const remove = () => {
        sparkle.remove()
        live.delete(sparkle)
      }
      sparkle.addEventListener('animationend', remove)
      layer.appendChild(sparkle)
      live.add(sparkle)

      // Cap the number of live sparkles so a fast mouse can't pile them up.
      if (live.size > MAX_SPARKLES) {
        const oldest = live.values().next().value
        if (oldest) {
          oldest.remove()
          live.delete(oldest)
        }
      }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      live.forEach((s) => s.remove())
      live.clear()
    }
  }, [])

  return <div ref={layerRef} className="cursor-trail-layer" aria-hidden="true" />
}
