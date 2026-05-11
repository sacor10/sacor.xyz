import { useEffect, useRef } from 'react'

export function LivestreamPlayer({
  src,
  title,
  isExpanded,
  onToggleExpanded,
  expandLabel = 'STRETCH PLAYER',
  collapseLabel = 'SHRINK PLAYER',
}) {
  const frameWrapRef = useRef(null)
  const buttonLabel = isExpanded ? collapseLabel : expandLabel
  const tableClassName = 'bevelbox livestream-player' + (isExpanded ? ' livestream-player-expanded' : '')

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
                onClick={onToggleExpanded}
              >
                &#9733; {buttonLabel} &#9733;
              </button>
            </div>
            <div className="livestream-frame-wrap" ref={frameWrapRef}>
              <iframe
                className="livestream-frame"
                src={src}
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
