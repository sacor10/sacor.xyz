import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { isKnownInterest } from '../data/stumbleInterests'
import StumbleToolbar from './stumble/StumbleToolbar'
import StumbleFrame from './stumble/StumbleFrame'
import InterestPicker from './stumble/InterestPicker'
import SignInModal from './stumble/SignInModal'
import './stumble/stumble.css'

const SEEN_KEY = 'su_seen_v1'
const NEWTAB_KEY = 'su_newtab_v1'
const INTERESTS_KEY = 'su_interests_v1'
const GUEST_SEEN_CAP = 150

function readSeen() {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function pushSeen(id) {
  try {
    const v = readSeen().filter((x) => x !== id)
    v.push(id)
    while (v.length > GUEST_SEEN_CAP) v.shift()
    localStorage.setItem(SEEN_KEY, JSON.stringify(v))
  } catch {
    /* ignore */
  }
}

function clearSeen() {
  try {
    localStorage.removeItem(SEEN_KEY)
  } catch {
    /* ignore */
  }
}

// Guest topic onboarding is stored as an object sentinel so we can tell
// "skipped — surprise me" (onboarded, empty list) apart from "never visited"
// (key absent). Slugs are filtered through isKnownInterest to drop anything
// stale/renamed before it reaches the backend.
function readGuestInterests() {
  try {
    const raw = localStorage.getItem(INTERESTS_KEY)
    if (raw == null) return { onboarded: false, interests: [] }
    const parsed = JSON.parse(raw)
    const interests = Array.isArray(parsed?.interests)
      ? parsed.interests.filter(isKnownInterest)
      : []
    return { onboarded: true, interests }
  } catch {
    return { onboarded: false, interests: [] }
  }
}

function writeGuestInterests(list) {
  try {
    localStorage.setItem(INTERESTS_KEY, JSON.stringify({ v: 1, interests: list }))
  } catch {
    /* ignore */
  }
}

function clearGuestInterests() {
  try {
    localStorage.removeItem(INTERESTS_KEY)
  } catch {
    /* ignore */
  }
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function siteNameForUrl(page) {
  const source = String(page?.title || domainOf(page?.url || '') || 'site').trim()
  const slug = source
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || 'site'
}

function replaceStumbleUrl(page, navigate) {
  if (typeof window === 'undefined') return
  const nextPath = page ? `/stumble/${siteNameForUrl(page)}` : '/stumble'
  if (window.location.pathname === nextPath) return
  navigate(nextPath, { replace: true })
}

// /stumble — StumbleUpon-style discovery loop. Rendered OUTSIDE Layout so it
// inherits none of the site's GeoCities theme.
export default function StumblePage() {
  const navigate = useNavigate()
  const { user, isSignedIn, loading: authLoading, signOut } = useAuth()

  const [card, setCard] = useState(null)
  const [status, setStatus] = useState('loading') // loading | idle | error | exhausted
  const [error, setError] = useState('')
  const [ratingBusy, setRatingBusy] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [likesCount, setLikesCount] = useState(0)

  const [newTab, setNewTab] = useState(() => {
    try {
      return localStorage.getItem(NEWTAB_KEY) === '1'
    } catch {
      return false
    }
  })

  const [catalog, setCatalog] = useState([])
  const [selected, setSelected] = useState([])
  // Guest topic selection, seeded from localStorage. Drives the picker's
  // pre-fill; signed-in users use `selected` (their server-saved interests).
  const [guestInterests, setGuestInterests] = useState(() => readGuestInterests().interests)
  const [minInterests, setMinInterests] = useState(3)
  const [catalogReady, setCatalogReady] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [savingInterests, setSavingInterests] = useState(false)

  const newTabRef = useRef(newTab)
  const selectedRef = useRef(selected)
  // Mirror of the guest selection that stumble() reads, so the request can
  // narrow without re-creating the callback. Kept in sync with `guestInterests`
  // by the effect below; read only on the guest path (signed-in users filter
  // server-side).
  const guestInterestsRef = useRef([])
  const startedRef = useRef(false)
  const prevSignedInRef = useRef(false)

  useEffect(() => {
    newTabRef.current = newTab
  }, [newTab])
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])
  // Keep the ref stumble() reads in sync with the guest selection so the
  // request can narrow without widening stumble's dependencies. (Handlers also
  // set the ref synchronously before calling stumble() to avoid the async gap.)
  useEffect(() => {
    guestInterestsRef.current = guestInterests
  }, [guestInterests])

  // Own this route's chrome: neutralize the purple body bg + set the title,
  // restoring both on unmount so other routes are unaffected.
  useEffect(() => {
    document.body.classList.add('su-active')
    const prevTitle = document.title
    document.title = 'Stumble — sacor.xyz'
    return () => {
      document.body.classList.remove('su-active')
      document.title = prevTitle
    }
  }, [])

  const stumble = useCallback(async () => {
    setStatus('loading')
    setError('')
    try {
      const params = new URLSearchParams()
      if (!isSignedIn) {
        const seen = readSeen()
        if (seen.length) params.set('exclude', seen.slice(-100).join(','))
        const ints = guestInterestsRef.current
        if (ints.length) params.set('interests', ints.join(','))
      }
      const qs = params.toString()
      const res = await fetch(`/.netlify/functions/stumble${qs ? `?${qs}` : ''}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('request failed')
      const data = await res.json()
      if (!data.page) {
        setCard(null)
        replaceStumbleUrl(null, navigate)
        setStatus('exhausted')
        return
      }
      setCard(data.page)
      replaceStumbleUrl(data.page, navigate)
      setStatus('idle')
      if (!isSignedIn) pushSeen(data.page.id)
      if (newTabRef.current) {
        window.open(data.page.url, '_blank', 'noopener,noreferrer')
      }
    } catch {
      setStatus('error')
      setError('Could not load the next page. Try again.')
    }
  }, [isSignedIn, navigate])

  const rate = useCallback(
    async (value) => {
      if (!card) return
      if (!isSignedIn) {
        setShowSignIn(true)
        return
      }
      setRatingBusy(true)
      try {
        const res = await fetch('/.netlify/functions/stumble-ratings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ pageId: card.id, value }),
        })
        if (res.ok) {
          const data = await res.json()
          if (typeof data.likesCount === 'number') setLikesCount(data.likesCount)
        }
      } catch {
        /* still advance — a dropped rating shouldn't trap the user */
      }
      setRatingBusy(false)
      stumble()
    },
    [card, isSignedIn, stumble],
  )

  const startOver = useCallback(() => {
    clearSeen()
    stumble()
  }, [stumble])

  const openExternal = useCallback(() => {
    if (!card?.url) return
    window.open(card.url, '_blank', 'noopener,noreferrer')
  }, [card])

  const toggleNewTab = useCallback(() => {
    setNewTab((v) => {
      const next = !v
      try {
        localStorage.setItem(NEWTAB_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const saveInterests = useCallback(
    async (list) => {
      // Guests can't persist server-side (the PUT 401s) — store their picks
      // locally and feed them to the next stumble() via the ref.
      if (!isSignedIn) {
        writeGuestInterests(list)
        guestInterestsRef.current = list
        setGuestInterests(list)
        setShowOnboarding(false)
        stumble()
        return
      }
      setSavingInterests(true)
      try {
        const res = await fetch('/.netlify/functions/stumble-interests', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ interests: list }),
        })
        if (res.ok) {
          const data = await res.json()
          setSelected(data.selected || list)
          setShowOnboarding(false)
          stumble()
        }
      } catch {
        /* leave the picker open on failure */
      } finally {
        setSavingInterests(false)
      }
    },
    [isSignedIn, stumble],
  )

  // Guest chose "surprise me": record that they onboarded (empty list) so we
  // don't re-prompt next visit, then stumble the broad pool.
  const skipInterests = useCallback(() => {
    writeGuestInterests([])
    guestInterestsRef.current = []
    setGuestInterests([])
    setShowOnboarding(false)
    stumble()
  }, [stumble])

  // Load the interest catalog (+ this user's saved selection) once.
  useEffect(() => {
    let cancelled = false
    fetch('/.netlify/functions/stumble-interests', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) {
          if (!cancelled) setCatalogReady(true)
          return
        }
        setCatalog(data.interests || [])
        setSelected(data.selected || [])
        setMinInterests(data.minInterests || 3)
        if (typeof data.likesCount === 'number') setLikesCount(data.likesCount)
        setCatalogReady(true)
      })
      .catch(() => {
        if (!cancelled) setCatalogReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Kick off once auth + catalog are ready: onboard signed-in users without
  // enough interests, otherwise start stumbling.
  useEffect(() => {
    if (startedRef.current) return
    if (authLoading || !catalogReady) return
    startedRef.current = true
    prevSignedInRef.current = isSignedIn
    // Onboard signed-in users without enough interests, and first-visit guests
    // (returning guests — including those who skipped — carry the sentinel and
    // skip straight to stumbling). The ref that narrows a guest's feed is seeded
    // by the sync effect above.
    const needsOnboarding = isSignedIn
      ? selectedRef.current.length < minInterests
      : !readGuestInterests().onboarded
    if (needsOnboarding) setShowOnboarding(true)
    else stumble()
  }, [authLoading, catalogReady, isSignedIn, minInterests, stumble])

  // React to a guest signing in mid-session (e.g. from the rate prompt).
  useEffect(() => {
    const was = prevSignedInRef.current
    prevSignedInRef.current = isSignedIn
    if (!isSignedIn || was || !startedRef.current) return
    setShowSignIn(false)
    // Their server interests now drive filtering; drop the guest sentinel so a
    // later sign-out won't resurrect stale local topics.
    clearGuestInterests()
    fetch('/.netlify/functions/stumble-interests', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const sel = data?.selected || []
        setSelected(sel)
        if (typeof data?.likesCount === 'number') setLikesCount(data.likesCount)
        if (sel.length < (data?.minInterests || minInterests)) {
          setShowOnboarding(true)
        } else {
          stumble()
        }
      })
      .catch(() => {})
  }, [isSignedIn, minInterests, stumble])

  // Keyboard shortcuts (PRD §6.2): Space = stumble, ↑ = like, ↓ = dislike.
  useEffect(() => {
    const onKey = (e) => {
      if (showOnboarding || showSignIn) return
      const t = e.target
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        stumble()
      } else if (e.code === 'ArrowUp') {
        e.preventDefault()
        rate(1)
      } else if (e.code === 'ArrowDown') {
        e.preventDefault()
        rate(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stumble, rate, showOnboarding, showSignIn])

  let content
  if (status === 'loading') {
    content = (
      <div className="su-message">
        <span className="su-spinner" />
      </div>
    )
  } else if (status === 'error') {
    content = (
      <div className="su-message">
        <h2>Hmm, that didn’t work.</h2>
        <p>{error}</p>
        <button type="button" className="su-stumble-btn" onClick={stumble}>
          Try again
        </button>
      </div>
    )
  } else if (status === 'exhausted') {
    content = (
      <div className="su-message">
        <h2>You’ve seen it all!</h2>
        <p>
          That’s every page in the pool for now.{' '}
          {isSignedIn ? 'Check back soon for more.' : 'Sign in for personalized picks, or start over.'}
        </p>
        <button
          type="button"
          className="su-stumble-btn"
          onClick={isSignedIn ? stumble : startOver}
        >
          {isSignedIn ? 'Try again' : 'Start over'}
        </button>
      </div>
    )
  } else if (card) {
    content = (
      <StumbleFrame
        card={card}
        onLike={() => rate(1)}
        onDislike={() => rate(-1)}
        onOpenExternal={openExternal}
        busy={ratingBusy || status === 'loading'}
        canRate={isSignedIn}
      />
    )
  } else {
    content = (
      <div className="su-message">
        <span className="su-spinner" />
      </div>
    )
  }

  return (
    <div className="su-root">
      <StumbleToolbar
        onStumble={stumble}
        busy={status === 'loading' || ratingBusy}
        user={user}
        isSignedIn={isSignedIn}
        likesCount={likesCount}
        onOpenSignIn={() => setShowSignIn(true)}
        onSignOut={signOut}
        newTab={newTab}
        onToggleNewTab={toggleNewTab}
        onRepickInterests={() => setShowOnboarding(true)}
        onStartOver={startOver}
        card={card}
        onLike={() => rate(1)}
        onDislike={() => rate(-1)}
        onOpenExternal={openExternal}
        canRate={isSignedIn}
      />

      <main className="su-stage">{content}</main>

      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}

      {showOnboarding && (
        <InterestPicker
          catalog={catalog}
          initial={isSignedIn ? selected : guestInterests}
          minInterests={minInterests}
          busy={savingInterests}
          onSave={saveInterests}
          allowSkip={!isSignedIn}
          onSkip={skipInterests}
        />
      )}
    </div>
  )
}
