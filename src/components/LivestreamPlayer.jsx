import { useCallback, useEffect, useMemo, useRef } from 'react'
import { loadYoutubeIframeApi } from '../lib/youtubeIframeApi'

// If the player becomes ready but never actually starts playing within this
// window, treat the channel as offline. YouTube's live_stream embed shows its
// "An error occurred" screen when there's no current broadcast, and that path
// doesn't always emit a clean onError — so a "readied but never played" timeout
// is the backstop. Generous, because a live stream on a slow connection can
// take a few seconds to buffer, and we never want to hide a stream that's live.
const OFFLINE_GRACE_MS = 9000

export function LivestreamPlayer({
  src,
  title,
  isExpanded,
  onToggleExpanded,
  expandLabel = 'STRETCH PLAYER',
  collapseLabel = 'SHRINK PLAYER',
  autoUnmute = false,
  onLivenessChange,
}) {
  const frameWrapRef = useRef(null)
  const iframeRef = useRef(null)
  const playerRef = useRef(null)
  const sawPlaybackRef = useRef(false)
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

  const report = useCallback(
    (state) => {
      if (state === 'live') sawPlaybackRef.current = true
      onLivenessChange?.(state)
    },
    [onLivenessChange],
  )

  const requestPlayback = useCallback((withSound = false) => {
    const player = playerRef.current
    if (!player || typeof player.playVideo !== 'function') return
    try {
      player.playVideo()
      if (withSound) {
        player.setVolume(100)
        player.unMute()
      }
    } catch {
      // Player not ready yet; the onReady handler will kick playback.
    }
  }, [])

  const handleToggleExpanded = () => {
    requestPlayback(true)
    onToggleExpanded()
  }

  // Attach the IFrame Player API to the frame so we can both drive playback and
  // observe whether the stream is actually live (playing) or offline (errored /
  // never started). Re-runs if the source changes.
  useEffect(() => {
    let cancelled = false
    let graceTimer

    sawPlaybackRef.current = false

    loadYoutubeIframeApi()
      .then((YT) => {
        if (cancelled || !iframeRef.current) return
        playerRef.current = new YT.Player(iframeRef.current, {
          events: {
            onReady: () => {
              requestPlayback(isExpanded || autoUnmute)
              graceTimer = window.setTimeout(() => {
                if (!sawPlaybackRef.current) report('offline')
              }, OFFLINE_GRACE_MS)
            },
            onStateChange: (event) => {
              // 1 = playing, 3 = buffering: either means there's a live feed.
              if (event.data === 1 || event.data === 3) report('live')
            },
            onError: () => report('offline'),
          },
        })
      })
      .catch(() => {
        // API failed to load — leave the raw iframe in place so a live stream
        // still plays. We just can't detect the offline case in that scenario.
      })

    return () => {
      cancelled = true
      window.clearTimeout(graceTimer)
      // Don't call player.destroy(): React removes the iframe itself on unmount
      // (which stops playback), and letting YouTube yank the same node first
      // triggers a removeChild crash during client-side navigation.
      playerRef.current = null
    }
  }, [playerSrc, autoUnmute, isExpanded, report, requestPlayback])

  // Nudge playback (with sound) whenever the stream is expanded or auto-unmuted.
  useEffect(() => {
    requestPlayback(isExpanded || autoUnmute)
  }, [isExpanded, autoUnmute, requestPlayback])

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
