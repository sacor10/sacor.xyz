import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import SignInModal from './SignInModal'
import ClaimUsernameModal from './ClaimUsernameModal'
import './stumble.css'

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// A liked page rendered as a compact card that opens the site in a new tab.
function LikeCard({ card }) {
  return (
    <a className="su-like-card" href={card.url} target="_blank" rel="noopener noreferrer">
      <span className="su-like-thumb">
        {card.thumbnailUrl ? (
          <img src={card.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <span className="su-like-thumb-ph">{(card.title || '?').charAt(0).toUpperCase()}</span>
        )}
      </span>
      <span className="su-like-meta">
        <span className="su-like-domain">{domainOf(card.url)}</span>
        <span className="su-like-title">{card.title}</span>
        {card.likedBy && <span className="su-like-by">liked by @{card.likedBy}</span>}
      </span>
    </a>
  )
}

function UserList({ users, empty }) {
  const rows = (users || []).filter((u) => u.username)
  if (!rows.length) return <div className="su-empty">{empty}</div>
  return (
    <ul className="su-userlist">
      {rows.map((u) => (
        <li key={u.username}>
          <Link className="su-userrow" to={`/stumble/u/${u.username}`}>
            <span className="su-avatar su-avatar--sm">{u.username.charAt(0).toUpperCase()}</span>
            <span className="su-handle">@{u.username}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// /stumble/u/:username — a public profile: liked pages, follow/unfollow, the
// social graph, and (on your own profile) a feed of recent likes from people
// you follow. Rendered OUTSIDE Layout, like StumblePage.
export default function StumbleProfilePage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { user, isSignedIn, signOut } = useAuth()

  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | notfound | error
  const [tab, setTab] = useState('likes')
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followBusy, setFollowBusy] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [showClaim, setShowClaim] = useState(false)
  const [feed, setFeed] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Own this route's chrome (neutralize the purple body bg + set the title).
  useEffect(() => {
    document.body.classList.add('su-active')
    const prevTitle = document.title
    document.title = `@${username} — Stumble`
    return () => {
      document.body.classList.remove('su-active')
      document.title = prevTitle
    }
  }, [username])

  // "Try again" / refresh — bumps the key the fetch effect depends on. Setting
  // state here (an event handler) is fine; doing it inside the effect is not.
  const reload = useCallback(() => {
    setStatus('loading')
    setReloadKey((k) => k + 1)
  }, [])

  // Fetch the profile whenever the handle, sign-in state, or reload key changes.
  // All state updates happen in async callbacks to satisfy set-state-in-effect.
  useEffect(() => {
    let cancelled = false
    fetch(`/.netlify/functions/stumble-profile?username=${encodeURIComponent(username)}`, {
      credentials: 'same-origin',
    })
      .then((r) => {
        if (r.status === 404) return { notfound: true }
        if (!r.ok) return { failed: true }
        return r.json()
      })
      .then((d) => {
        if (cancelled || !d) return
        if (d.notfound) {
          setStatus('notfound')
          return
        }
        if (d.failed) {
          setStatus('error')
          return
        }
        setData(d)
        setIsFollowing(!!d.isFollowing)
        setFollowerCount(d.followerCount || 0)
        setTab('likes')
        setFeed(null)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [username, isSignedIn, reloadKey])

  // Lazily load the feed when its tab is first opened (your own profile only).
  // feed === null means "not loaded yet" and renders as the loading state.
  useEffect(() => {
    if (tab !== 'feed' || feed !== null) return
    let cancelled = false
    fetch('/.netlify/functions/stumble-feed', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setFeed(d?.items || [])
      })
      .catch(() => {
        if (!cancelled) setFeed([])
      })
    return () => {
      cancelled = true
    }
  }, [tab, feed])

  const isSelf = !!data?.isSelf

  const doFollow = useCallback(
    async (action) => {
      setFollowBusy(true)
      try {
        const res = await fetch('/.netlify/functions/stumble-follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ username, action }),
        })
        const d = await res.json().catch(() => ({}))
        if (res.status === 409 && d.needsUsername) {
          setShowClaim(true)
          return
        }
        if (res.ok) {
          setIsFollowing(!!d.isFollowing)
          if (typeof d.followerCount === 'number') setFollowerCount(d.followerCount)
        }
      } finally {
        setFollowBusy(false)
      }
    },
    [username],
  )

  const onFollowClick = useCallback(() => {
    if (!isSignedIn) {
      setShowSignIn(true)
      return
    }
    doFollow(isFollowing ? 'unfollow' : 'follow')
  }, [isSignedIn, isFollowing, doFollow])

  const claimUsername = useCallback(
    async (name) => {
      const res = await fetch('/.netlify/functions/stumble-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username: name }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Could not claim that username.')
      setShowClaim(false)
      doFollow('follow') // resume the follow that prompted the claim
    },
    [doFollow],
  )

  const stumbleTheirLikes = useCallback(() => {
    navigate(`/stumble?from=${encodeURIComponent(username)}`)
  }, [navigate, username])

  let body
  if (status === 'loading') {
    body = (
      <div className="su-message">
        <span className="su-spinner" />
      </div>
    )
  } else if (status === 'notfound') {
    body = (
      <div className="su-message">
        <h2>No such stumbler</h2>
        <p>@{username} hasn’t claimed a profile.</p>
        <button type="button" className="su-stumble-btn" onClick={() => navigate('/stumble')}>
          Back to Stumble
        </button>
      </div>
    )
  } else if (status === 'error' || !data) {
    body = (
      <div className="su-message">
        <h2>Hmm, that didn’t work.</h2>
        <p>Could not load this profile.</p>
        <button type="button" className="su-stumble-btn" onClick={reload}>
          Try again
        </button>
      </div>
    )
  } else {
    body = (
      <>
        <div className="su-subbar su-profile-bar">
          <span className="su-avatar su-avatar--lg" aria-hidden="true">
            {(data.username || '?').charAt(0).toUpperCase()}
          </span>
          <div className="su-profile-id">
            <span className="su-handle">@{data.username}</span>
            <span className="su-profile-counts">
              <button type="button" className="su-countlink" onClick={() => setTab('following')}>
                <strong>{data.followingCount}</strong> Following
              </button>
              <button type="button" className="su-countlink" onClick={() => setTab('followers')}>
                <strong>{followerCount}</strong> Followers
              </button>
            </span>
          </div>

          <span className="su-bar-spacer" />

          {isSelf ? (
            <span className="su-self-badge">This is you</span>
          ) : (
            <button
              type="button"
              className={`su-follow-btn${isFollowing ? ' su-follow-btn--on' : ''}`}
              onClick={onFollowClick}
              disabled={followBusy}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
          <button
            type="button"
            className="su-subbar-btn su-subbar-btn-primary"
            onClick={stumbleTheirLikes}
          >
            Stumble their likes
          </button>
        </div>

        <nav className="su-tabs" aria-label="Profile sections">
          <button type="button" className="su-tab" aria-selected={tab === 'likes'} onClick={() => setTab('likes')}>
            Likes
          </button>
          {isSelf && (
            <button type="button" className="su-tab" aria-selected={tab === 'feed'} onClick={() => setTab('feed')}>
              Feed
            </button>
          )}
          <button
            type="button"
            className="su-tab"
            aria-selected={tab === 'following'}
            onClick={() => setTab('following')}
          >
            Following
          </button>
          <button
            type="button"
            className="su-tab"
            aria-selected={tab === 'followers'}
            onClick={() => setTab('followers')}
          >
            Followers
          </button>
        </nav>

        <main className="su-profile-stage">
          {tab === 'likes' &&
            (data.signInRequired ? (
              <div className="su-empty">
                Sign in to see what @{data.username} likes.{' '}
                <button type="button" className="su-link" onClick={() => setShowSignIn(true)}>
                  Sign in
                </button>
              </div>
            ) : data.likedPages?.length ? (
              <div className="su-likes-grid">
                {data.likedPages.map((c) => (
                  <LikeCard key={c.id} card={c} />
                ))}
              </div>
            ) : (
              <div className="su-empty">No liked pages yet.</div>
            ))}

          {tab === 'feed' &&
            isSelf &&
            (feed === null ? (
              <div className="su-empty">
                <span className="su-spinner" />
              </div>
            ) : feed.length ? (
              <div className="su-likes-grid">
                {feed.map((c) => (
                  <LikeCard key={`${c.id}-${c.likedBy || ''}`} card={c} />
                ))}
              </div>
            ) : (
              <div className="su-empty">Follow some people and their recent likes show up here.</div>
            ))}

          {tab === 'following' && <UserList users={data.following} empty="Not following anyone yet." />}
          {tab === 'followers' && <UserList users={data.followers} empty="No followers yet." />}
        </main>
      </>
    )
  }

  return (
    <div className="su-root">
      <header className="su-toolbar">
        <button type="button" className="su-stumble-btn" onClick={() => navigate('/stumble')}>
          Stumble!
        </button>
        <span className="su-tagline">to discover the best of the web</span>
        <span className="su-bar-spacer" />
        {isSignedIn ? (
          <span className="su-account">
            <span className="su-account-email">{user?.email}</span>
            <button type="button" className="su-signout" onClick={signOut}>
              Sign Out
            </button>
          </span>
        ) : (
          <button type="button" className="su-google-pill" onClick={() => setShowSignIn(true)}>
            Sign in
          </button>
        )}
      </header>

      {body}

      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
      {showClaim && (
        <ClaimUsernameModal
          onClose={() => setShowClaim(false)}
          onClaim={claimUsername}
          reason="Claim a username before you can follow people."
        />
      )}
    </div>
  )
}
