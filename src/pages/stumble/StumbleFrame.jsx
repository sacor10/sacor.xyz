import { useEffect, useState } from 'react'
import PreviewCard from './PreviewCard'

// Backstop only: the server-side probe is the source of truth for whether a site
// can be framed. This timeout just covers the rare case where the probe itself
// never returns, so the user isn't stuck on a spinner.
const FRAME_TIMEOUT_MS = 7000

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Body copy under the headline, tailored to why the site won't load. Framing
// blocks get the X-Frame-Options/CSP explanation; reachability problems get a
// plainer note. Falls back to the framing copy when we have no specific reason
// (known-blocked curation, or the timeout backstop).
function fallbackBody(reason) {
  if (reason === 'http-error') {
    return 'The site responded with an error, so there’s nothing to show here. You can still try opening it externally.'
  }
  if (reason === 'unreachable' || reason === 'timeout') {
    return 'The site couldn’t be reached right now. It may be down or blocking automated requests — try opening it externally.'
  }
  return 'Some sites use X-Frame-Options or Content-Security-Policy rules to stay out of iframes. You can still open this stumble externally.'
}

export default function StumbleFrame({
  card,
  onLike,
  onDislike,
  busy,
  canRate,
}) {
  // Iframe load / timeout tracking.
  const [frameState, setFrameState] = useState({ cardKey: '', status: 'loading' })
  // Server-side probe verdict: 'pending' | 'ok' | 'failed' (+ reason/message).
  const [probe, setProbe] = useState({ cardKey: '', status: 'pending' })

  const cardKey = card?.id || card?.url || ''
  const framePolicy = card?.framePolicy
  const knownBlocked = framePolicy === 'block'

  const frameStatus = frameState.cardKey === cardKey ? frameState.status : 'loading'
  const probeForCard = probe.cardKey === cardKey ? probe : { status: 'pending' }

  // Probe whether the site can actually be framed. The browser can't read why a
  // cross-origin frame failed (an X-Frame-Options block still fires onLoad), so
  // this verdict — not onLoad — decides whether we show the fallback. Fails open:
  // a probe error is treated as "ok" so a flaky probe never hides a good site.
  useEffect(() => {
    if (!cardKey || knownBlocked) return undefined
    // No synchronous "pending" set needed: until this resolves, probe.cardKey
    // won't match the current card, so probeForCard already reads as pending.
    let cancelled = false
    fetch(`/.netlify/functions/stumble-frame-check?url=${encodeURIComponent(card.url)}`, {
      credentials: 'same-origin',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data && data.ok === false) {
          // Loud in the console because the probe's Network row stays 200 (the
          // function fails open) — otherwise the reason a site was blocked only
          // lives in the response body. Tied to the exact card's domain.
          console.warn(
            `[stumble] frame blocked: ${domainOf(card.url)} — ${data.reason}` +
              (data.status ? ` (HTTP ${data.status})` : '') +
              (data.message ? ` — ${data.message}` : ''),
          )
          setProbe({ cardKey, status: 'failed', reason: data.reason, message: data.message })
        } else {
          setProbe({ cardKey, status: 'ok' })
        }
      })
      .catch(() => {
        if (!cancelled) setProbe({ cardKey, status: 'ok' })
      })
    return () => {
      cancelled = true
    }
  }, [cardKey, knownBlocked, card?.url])

  useEffect(() => {
    if (!cardKey || knownBlocked) return undefined

    const timer = window.setTimeout(() => {
      setFrameState((state) => {
        const status = state.cardKey === cardKey ? state.status : 'loading'
        if (status !== 'loading') return state
        return { cardKey, status: 'suspected-blocked' }
      })
    }, FRAME_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [cardKey, knownBlocked])

  if (!card) return null

  const probeFailed = probeForCard.status === 'failed'
  const timedOut = frameStatus === 'suspected-blocked'
  // Only call the iframe "loaded" once the probe has cleared it — onLoad alone
  // fires even on a blocked frame showing the browser's raw error page.
  const loaded = frameStatus === 'loaded' && probeForCard.status === 'ok'

  const showFallback = knownBlocked || probeFailed || timedOut
  const overlay = showFallback && !knownBlocked
  const showSpinner = !showFallback && !loaded

  const domain = domainOf(card.url)
  const reason = probeFailed ? probeForCard.reason : undefined
  let heading
  if (probeFailed && probeForCard.message) {
    heading = probeForCard.message
  } else if (knownBlocked) {
    heading = 'This site blocks embedded browsing.'
  } else {
    heading = 'This page may not allow embedded browsing.'
  }

  const currentFrameState = knownBlocked
    ? 'known-blocked'
    : showFallback
      ? 'suspected-blocked'
      : loaded
        ? 'loaded'
        : 'loading'

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

      {showSpinner && (
        <div className="su-frame-status" role="status" aria-live="polite">
          <span className="su-spinner" />
          <span>Loading {domain}...</span>
        </div>
      )}

      {showFallback && (
        <div className={overlay ? 'su-frame-fallback su-frame-fallback-overlay' : 'su-frame-fallback'}>
          <div className="su-frame-fallback-copy">
            <p className="su-frame-domain">{domain}</p>
            <h2>{heading}</h2>
            <p>{fallbackBody(reason)}</p>
            <a className="su-primary" href={card.url} target="_blank" rel="noopener noreferrer">
              Open externally
            </a>
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
