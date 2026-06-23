import { Link } from 'react-router-dom'

// The slim StumbleUpon-style toolbar. Intentionally minified: a way back to the
// main site plus the core Stumble controls — no GeoCities chrome, no links to
// the rest of sacor.xyz.
export default function StumbleToolbar({
  onStumble,
  onLike,
  onDislike,
  onVisit,
  busy,
  canRate,
  hasCard,
  newTab,
  onToggleNewTab,
}) {
  return (
    <header className="su-toolbar">
      <Link className="su-back" to="/">
        ← Back to sacor.xyz
      </Link>
      <span className="su-brand">
        <b>Stumble</b>Upon
      </span>

      <button
        type="button"
        className="su-stumble-btn"
        onClick={onStumble}
        disabled={busy}
      >
        Stumble!
      </button>

      <div className="su-controls">
        <button
          type="button"
          className="su-iconbtn"
          onClick={onLike}
          disabled={!hasCard || busy}
          title={canRate ? 'I like this (↑)' : 'Sign in to rate'}
          aria-label="Thumbs up"
        >
          👍
        </button>
        <button
          type="button"
          className="su-iconbtn"
          onClick={onDislike}
          disabled={!hasCard || busy}
          title={canRate ? 'Not for me (↓)' : 'Sign in to rate'}
          aria-label="Thumbs down"
        >
          👎
        </button>
        <button
          type="button"
          className="su-iconbtn su-iconbtn-text"
          onClick={onVisit}
          disabled={!hasCard}
          title="Open this page in a new tab"
        >
          Visit ↗
        </button>
      </div>

      <span className="su-spacer" />

      <label className="su-toggle">
        <input type="checkbox" checked={newTab} onChange={onToggleNewTab} />
        Open in new tab
      </label>
    </header>
  )
}
