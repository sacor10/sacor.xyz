import { useCallback, useEffect, useMemo, useRef } from 'react'

export function LivestreamPlayer({
  src,
  title,
  isExpanded,
  onToggleExpanded,
  expandLabel = 'STRETCH PLAYER',
  collapseLabel = 'SHRINK PLAYER',
  autoUnmute = false,
}) {
  const frameWrapRef = useRef(null)
  const iframeRef = useRef(null)
  const buttonLabel = isExpanded ? collapseLabel : expandLabel
  const tableClassName = 'bevelbox livestream-player' + (isExpanded ? ' livestream-player-expanded' : '')
  const playerSrc = useMemo(() => {
    if (typeof window === 'undefined') return src

    try {
      const url = new URL(src)
      url.searchParams.set('origin', window.location.origin)
      return url.toString()
    } catch {
      return src
    }
  }, [src])

  const sendYoutubeCommand = useCallback((func, args = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      'https://www.youtube.com'
    )
  }, [])

  const requestPlayback = useCallback((withSound = false) => {
    sendYoutubeCommand('playVideo')
    if (withSound) {
      sendYoutubeCommand('setVolume', [100])
      sendYoutubeCommand('unMute')
    }
  }, [sendYoutubeCommand])

  const handleToggleExpanded = () => {
    requestPlayback(true)
    onToggleExpanded()
  }

  useEffect(() => {
    const withSound = isExpanded || autoUnmute
    const attempts = [150, 500, 1000, 1800].map((delay) => (
      window.setTimeout(() => requestPlayback(withSound), delay)
    ))

    return () => {
      attempts.forEach((attempt) => window.clearTimeout(attempt))
    }
  }, [isExpanded, autoUnmute, playerSrc, requestPlayback])

  useEffect(() => {
    if (!isExpanded) return

    const frameWrap = frameWrapRef.current
    if (!frameWrap) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const frame = requestAnimationFrame(() => {
      frameWrap.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      })
    })

    return () => cancelAnimationFrame(frame)
  }, [isExpanded])

  return (
    <table
      width="100%"
      cellPadding={isExpanded ? 0 : 8}
      cellSpacing="0"
      border="0"
      className={tableClassName}
      bgcolor="#000000"
    >
      <tbody>
        <tr>
          <td bgcolor="#000000" align="center">
            <div className="livestream-toolbar">
              <button
                type="button"
                className="navbtn-link livestream-toggle"
                aria-pressed={isExpanded}
                aria-label={`${buttonLabel} for ${title}`}
                onClick={handleToggleExpanded}
              >
                &#9733; {buttonLabel} &#9733;
              </button>
            </div>
            <div className="livestream-frame-wrap" ref={frameWrapRef}>
              <iframe
                ref={iframeRef}
                className="livestream-frame"
                src={playerSrc}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                frameBorder="0"
                onLoad={() => requestPlayback(isExpanded || autoUnmute)}
              />
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

// Shown in place of the player when the channel isn't streaming (or while we're
// still checking, or if the live check itself failed). Keeps the same 16:9
// footprint as the player so the layout doesn't jump when a stream goes live.
export function LivestreamOfflineNotice({ title, watchUrl, note, status = 'offline' }) {
  const heading =
    status === 'loading'
      ? `Checking if ${title} is live…`
      : status === 'error'
        ? `Couldn't reach ${title} right now.`
        : `${title} is off the air right now.`

  return (
    <table
      width="100%"
      cellPadding="8"
      cellSpacing="0"
      border="0"
      className="bevelbox livestream-player"
      bgcolor="#000000"
    >
      <tbody>
        <tr>
          <td bgcolor="#000000" align="center">
            <div className="livestream-frame-wrap livestream-offline">
              <font face="Comic Sans MS" size="4" color="#FFFF00">
                {heading}
              </font>
              {note ? (
                <>
                  <br />
                  <font face="Comic Sans MS" size="3" color="#00FFFF">
                    {note}
                  </font>
                </>
              ) : null}
              {watchUrl ? (
                <>
                  <br />
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="navbtn-link"
                  >
                    &#9733; WATCH LIVE ON YOUTUBE &#9733;
                  </a>
                </>
              ) : null}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function LivestreamWideNotice({ title, onCollapse }) {
  return (
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
      <tbody>
        <tr>
          <td bgcolor="#000000" align="center">
            <font face="Comic Sans MS" size="3" color="#00FFFF">
              {title} is stretched across the page.
            </font>
            <br />
            <br />
            <button
              type="button"
              className="navbtn-link livestream-toggle"
              aria-label={`Return ${title} to the column player`}
              onClick={onCollapse}
            >
              &#9733; RETURN PLAYER HERE &#9733;
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
