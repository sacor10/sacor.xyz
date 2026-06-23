import { useEffect, useState } from 'react'
import PreviewCard from './PreviewCard'

const FRAME_TIMEOUT_MS = 7000

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function StumbleFrame({
  card,
  onLike,
  onDislike,
  onOpenExternal,
  busy,
  canRate,
}) {
  const [frameState, setFrameState] = useState({ cardKey: '', status: 'loading' })
  const cardKey = card?.id || card?.url || ''
  const framePolicy = card?.framePolicy
  const currentFrameState =
    framePolicy === 'block'
      ? 'known-blocked'
      : frameState.cardKey === cardKey
        ? frameState.status
        : 'loading'

  useEffect(() => {
    if (!cardKey || framePolicy === 'block') return undefined

    const timer = window.setTimeout(() => {
      setFrameState((state) => {
        const status = state.cardKey === cardKey ? state.status : 'loading'
        if (status !== 'loading') return state
        return { cardKey, status: 'suspected-blocked' }
      })
    }, FRAME_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [cardKey, framePolicy])

  if (!card) return null

  const knownBlocked = currentFrameState === 'known-blocked'
  const suspectedBlocked = currentFrameState === 'suspected-blocked'
  const showFallback = knownBlocked || suspectedBlocked
  const domain = domainOf(card.url)

  return (
    <section className={`su-frame-shell su-frame-shell--${currentFrameState}`}>
      {!knownBlocked && (
        <iframe
          key={card.id}
          className="su-frame"
          src={card.url}
          title={card.title || domain}
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
          onLoad={() => setFrameState({ cardKey, status: 'loaded' })}
        />
      )}

      {currentFrameState === 'loading' && (
        <div className="su-frame-status" role="status" aria-live="polite">
          <span className="su-spinner" />
          <span>Loading {domain}...</span>
        </div>
      )}

      {showFallback && (
        <div
          className={
            knownBlocked
              ? 'su-frame-fallback'
              : 'su-frame-fallback su-frame-fallback-overlay'
          }
        >
          <div className="su-frame-fallback-copy">
            <p className="su-frame-domain">{domain}</p>
            <h2>
              {knownBlocked
                ? 'This site blocks embedded browsing.'
                : 'This page may not allow embedded browsing.'}
            </h2>
            <p>
              Some sites use X-Frame-Options or Content-Security-Policy rules to
              stay out of iframes. You can still open this stumble externally.
            </p>
            <button type="button" className="su-primary" onClick={onOpenExternal}>
              Open externally
            </button>
          </div>

          <PreviewCard
            card={card}
            onLike={onLike}
            onDislike={onDislike}
            busy={busy}
            canRate={canRate}
            showRatingActions={false}
            visitLabel="Open externally"
          />
        </div>
      )}
    </section>
  )
}
