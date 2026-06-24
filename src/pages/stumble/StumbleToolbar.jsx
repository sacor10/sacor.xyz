import { useEffect, useRef, useState } from 'react'

// The Google "G" glyph, inlined so the guest pill matches the real button.
function GoogleGlyph() {
  return (
    <span className="su-g-glyph" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
    </span>
  )
}

// The two stacked StumbleUpon bars: a charcoal top toolbar (Stumble + auth) and
// a white profile sub-bar (avatar, likes, social, menu). Rendered with none of
// the GeoCities chrome — it lives outside Layout under `.su-root`.
export default function StumbleToolbar({
  onStumble,
  busy,
  user,
  isSignedIn,
  likesCount,
  likes = [],
  onOpenLikes,
  onUnlike,
  onOpenSignIn,
  onSignOut,
  newTab,
  onToggleNewTab,
  onRepickInterests,
  onOpenSubmit,
  onStartOver,
  card,
  onLike,
  onDislike,
  onOpenExternal,
  canRate,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const [likesOpen, setLikesOpen] = useState(false)
  const likesRef = useRef(null)
  const [brokenAvatarUrl, setBrokenAvatarUrl] = useState('')

  const handle = isSignedIn && user?.email ? `@${user.email.split('@')[0]}` : '@'
  const avatarChar = isSignedIn && user?.email ? user.email.charAt(0).toUpperCase() : '?'
  const avatarUrl = isSignedIn ? user?.picture || '' : ''
  // Keying the failure to the URL means a new account's photo is retried
  // automatically — no reset effect needed when avatarUrl changes.
  const showAvatarImg = !!avatarUrl && brokenAvatarUrl !== avatarUrl

  // Close the ☰ menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Close the Likes dropdown on outside click / Escape.
  useEffect(() => {
    if (!likesOpen) return
    const onDown = (e) => {
      if (likesRef.current && !likesRef.current.contains(e.target)) setLikesOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setLikesOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [likesOpen])

  return (
    <>
      {/* Bar 1 — charcoal top toolbar */}
      <header className="su-toolbar">
        <button
          type="button"
          className="su-stumble-btn"
          onClick={onStumble}
          disabled={busy}
        >
          Stumble!
        </button>
        <span className="su-tagline">to discover the best of the web</span>

        <span className="su-bar-spacer" />

        {isSignedIn ? (
          <span className="su-account">
            <span className="su-account-email">{user?.email}</span>
            <button type="button" className="su-signout" onClick={onSignOut}>
              Sign Out
            </button>
          </span>
        ) : (
          <>
            <span className="su-join">Join for free:</span>
            <button type="button" className="su-google-pill" onClick={onOpenSignIn}>
              <GoogleGlyph />
              Connect with Google
            </button>
          </>
        )}
      </header>

      {/* Bar 2 — white profile sub-bar */}
      <div className="su-subbar">
        {showAvatarImg ? (
          <img
            className="su-avatar su-avatar-img"
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setBrokenAvatarUrl(avatarUrl)}
          />
        ) : (
          <span className="su-avatar" aria-hidden="true">
            {avatarChar}
          </span>
        )}
        <span className="su-handle">{handle}</span>

        <span className="su-divider" />

        <span className="su-likes-wrap" ref={likesRef}>
          <button
            type="button"
            className="su-likes-pill"
            title="Your likes"
            aria-expanded={likesOpen}
            onClick={() =>
              setLikesOpen((v) => {
                const next = !v
                if (next) onOpenLikes?.()
                return next
              })
            }
          >
            {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
            <span className="su-caret" aria-hidden="true">
              ▾
            </span>
          </button>
          {likesOpen && (
            <div className="su-likes-menu" role="menu">
              {likes.length === 0 ? (
                <p className="su-likes-empty">
                  No likes yet — hit Like on a page to save it.
                </p>
              ) : (
                likes.map((item) => (
                  <div key={item.id} className="su-likes-item">
                    <a
                      className="su-likes-link"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="su-likes-title">{item.title}</span>
                      <span className="su-likes-domain">{item.domain}</span>
                    </a>
                    <button
                      type="button"
                      className="su-likes-unlike"
                      title="Remove from likes"
                      aria-label={`Remove ${item.title} from likes`}
                      onClick={() => onUnlike?.(item.id)}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </span>
        <span className="su-social" title="Coming soon">
          Following • Followers
        </span>

        <span className="su-current-actions" aria-label="Current stumble actions">
          <button
            type="button"
            className="su-subbar-btn"
            onClick={onLike}
            disabled={busy || !card}
            title={canRate ? 'I like this (Up arrow)' : 'Sign in to rate'}
          >
            Like
          </button>
          <button
            type="button"
            className="su-subbar-btn"
            onClick={onDislike}
            disabled={busy || !card}
            title={canRate ? 'Not for me (Down arrow)' : 'Sign in to rate'}
          >
            Pass
          </button>
          <button
            type="button"
            className="su-subbar-btn su-subbar-btn-primary"
            onClick={onOpenExternal}
            disabled={!card}
            title={card ? `Open ${card.title || card.url} externally` : 'No page loaded'}
          >
            Open
          </button>
        </span>

        <span className="su-bar-spacer" />

        <span className="su-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="su-menu-btn"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
          {menuOpen && (
            <div className="su-menu" role="menu">
              <label className="su-menu-item su-menu-toggle">
                Auto-open externally
                <input type="checkbox" checked={newTab} onChange={onToggleNewTab} />
              </label>
              <button
                type="button"
                className="su-menu-item"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onRepickInterests()
                }}
              >
                Re-pick interests
              </button>
              <button
                type="button"
                className="su-menu-item"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onOpenSubmit()
                }}
              >
                Submit a site
              </button>
              {!isSignedIn && (
                <button
                  type="button"
                  className="su-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onStartOver()
                  }}
                >
                  Start over
                </button>
              )}
            </div>
          )}
        </span>
      </div>
    </>
  )
}
