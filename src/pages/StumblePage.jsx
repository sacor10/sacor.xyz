import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../auth/useAuth'
import GoogleSignInButton from '../auth/GoogleSignInButton'
import StumbleToolbar from './stumble/StumbleToolbar'
import PreviewCard from './stumble/PreviewCard'
import InterestPicker from './stumble/InterestPicker'
import './stumble/stumble.css'

const SEEN_KEY = 'su_seen_v1'
const NEWTAB_KEY = 'su_newtab_v1'
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

// /stumble — StumbleUpon-style discovery loop. Rendered OUTSIDE Layout so it
// inherits none of the site's GeoCities theme.
export default function StumblePage() {
  const { isSignedIn, loading: authLoading } = useAuth()

  const [card, setCard] = useState(null)
  const [status, setStatus] = useState('loading') // loading | idle | error | exhausted
  const [error, setError] = useState('')
  const [ratingBusy, setRatingBusy] = useState(false)
  const [signInPrompt, setSignInPrompt] = useState(false)

  const [newTab, setNewTab] = useState(() => {
    try {
      return localStorage.getItem(NEWTAB_KEY) === '1'
    } catch {
      return false
    }
  })

  const [catalog, setCatalog] = useState([])
  const [selected, setSelected] = useState([])
  const [minInterests, setMinInterests] = useState(3)
  const [catalogReady, setCatalogReady] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [savingInterests, setSavingInterests] = useState(false)

  const newTabRef = useRef(newTab)
  const selectedRef = useRef(selected)
  const startedRef = useRef(false)
  const prevSignedInRef = useRef(false)

  useEffect(() => {
    newTabRef.current = newTab
  }, [newTab])
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

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
    setSignInPrompt(false)
    setStatus('loading')
    setError('')
    try {
      const params = new URLSearchParams()
      if (!isSignedIn) {
        const seen = readSeen()
        if (seen.length) params.set('exclude', seen.slice(-100).join(','))
      }
      const qs = params.toString()
      const res = await fetch(`/.netlify/functions/stumble${qs ? `?${qs}` : ''}`, {
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('request failed')
      const data = await res.json()
      if (!data.page) {
        setCard(null)
        setStatus('exhausted')
        return
      }
      setCard(data.page)
      setStatus('idle')
      if (!isSignedIn) pushSeen(data.page.id)
      if (newTabRef.current) {
        window.open(data.page.url, '_blank', 'noopener,noreferrer')
      }
    } catch {
      setStatus('error')
      setError('Could not load the next page. Try again.')
    }
  }, [isSignedIn])

  const rate = useCallback(
    async (value) => {
      if (!card) return
      if (!isSignedIn) {
        setSignInPrompt(true)
        return
      }
      setRatingBusy(true)
      try {
        await fetch('/.netlify/functions/stumble-ratings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ pageId: card.id, value }),
        })
      } catch {
        /* still advance — a dropped rating shouldn't trap the user */
      }
      setRatingBusy(false)
      stumble()
    },
    [card, isSignedIn, stumble],
  )

  const visit = useCallback(() => {
    if (card) window.open(card.url, '_blank', 'noopener,noreferrer')
  }, [card])

  const startOver = useCallback(() => {
    clearSeen()
    stumble()
  }, [stumble])

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
    [stumble],
  )

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
    if (isSignedIn && selectedRef.current.length < minInterests) {
      setShowOnboarding(true)
    } else {
      stumble()
    }
  }, [authLoading, catalogReady, isSignedIn, minInterests, stumble])

  // React to a guest signing in mid-session (e.g. from the rate prompt).
  useEffect(() => {
    const was = prevSignedInRef.current
    prevSignedInRef.current = isSignedIn
    if (!isSignedIn || was || !startedRef.current) return
    setSignInPrompt(false)
    fetch('/.netlify/functions/stumble-interests', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const sel = data?.selected || []
        setSelected(sel)
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
      if (showOnboarding) return
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
  }, [stumble, rate, showOnboarding])

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
    content = <PreviewCard card={card} />
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
        onLike={() => rate(1)}
        onDislike={() => rate(-1)}
        onVisit={visit}
        busy={status === 'loading' || ratingBusy}
        canRate={isSignedIn}
        hasCard={!!card}
        newTab={newTab}
        onToggleNewTab={toggleNewTab}
      />

      <main className="su-stage">
        {signInPrompt && !isSignedIn && (
          <div className="su-signin">
            <p>
              <b>Sign in to rate.</b> Your 👍/👎 tune future stumbles — and guests can
              keep stumbling without an account.
            </p>
            <GoogleSignInButton />
          </div>
        )}
        {content}
      </main>

      {showOnboarding && (
        <InterestPicker
          catalog={catalog}
          initial={selected}
          minInterests={minInterests}
          busy={savingInterests}
          onSave={saveInterests}
        />
      )}
    </div>
  )
}
