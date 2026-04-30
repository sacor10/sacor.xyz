import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../Layout'
import { useAuth } from '../auth/useAuth'

const formatDate = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function GatedMessage({ loading, isSignedIn }) {
  return (
    <table width="100%" cellPadding="14" cellSpacing="0" border="0" className="postbox" bgColor="#000000">
      <tbody>
        <tr>
          <td align="center">
            <font face="Impact" size="5" color="#FF00FF">
              ~ AREA RESERVED FOR SACOR ~
            </font>
            <br />
            <br />
            <font face="Comic Sans MS" size="3" color="#FFFFFF">
              {loading
                ? 'checking your session...'
                : isSignedIn
                  ? 'You are signed in, but this area is for Sacor only. Sorry!'
                  : 'Sign in with Google in the top banner to access Sacor’s private travel itineraries.'}
            </font>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function NewPlanForm({ onCreated }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setTitle('')
    setDestination('')
    setBody('')
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/.netlify/functions/travel-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ title, destination, body }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Save failed (${res.status})`)
      }
      const plan = await res.json()
      reset()
      setOpen(false)
      onCreated?.(plan)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <center>
        <button type="button" className="dl-btn" onClick={() => setOpen(true)}>
          + NEW TRAVEL PLAN
        </button>
      </center>
    )
  }

  return (
    <table width="100%" cellPadding="10" cellSpacing="0" border="0" className="postbox travel-form" bgColor="#000000">
      <tbody>
        <tr>
          <td align="center" bgColor="#00FF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ NEW ITINERARY ~
            </font>
          </td>
        </tr>
        <tr>
          <td>
            <form onSubmit={handleSubmit}>
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  TITLE
                </font>
                <input
                  type="text"
                  value={title}
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. San Francisco Long Weekend"
                  required
                />
              </label>
              <br />
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  DESTINATION
                </font>
                <input
                  type="text"
                  value={destination}
                  maxLength={200}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. San Francisco, CA"
                />
              </label>
              <br />
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  ITINERARY (markdown)
                </font>
                <textarea
                  value={body}
                  rows={18}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Paste the markdown itinerary here..."
                />
              </label>
              {error && (
                <div className="travel-error">
                  <font face="Comic Sans MS" size="2" color="#FF00FF">
                    {error}
                  </font>
                </div>
              )}
              <br />
              <center>
                <button type="submit" className="dl-btn" disabled={submitting}>
                  {submitting ? 'SAVING...' : 'SAVE PLAN'}
                </button>
                &nbsp;&nbsp;
                <button
                  type="button"
                  className="navbtn-link"
                  onClick={() => {
                    reset()
                    setOpen(false)
                  }}
                >
                  CANCEL
                </button>
              </center>
            </form>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function PlansList() {
  const [plans, setPlans] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const res = await fetch('/.netlify/functions/travel-plans', { credentials: 'same-origin' })
      if (!res.ok) throw new Error(`Load failed (${res.status})`)
      const data = await res.json()
      setPlans(data.plans || [])
      setError('')
    } catch (err) {
      setError(err.message)
      setPlans([])
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/.netlify/functions/travel-plans', {
          credentials: 'same-origin',
        })
        if (!res.ok) throw new Error(`Load failed (${res.status})`)
        const data = await res.json()
        if (cancelled) return
        setPlans(data.plans || [])
        setError('')
      } catch (err) {
        if (cancelled) return
        setError(err.message)
        setPlans([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <NewPlanForm onCreated={load} />

      <br />

      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td align="center" bgColor="#FF00FF" className="section-bar">
                <font face="Impact" size="5" color="#FFFF00">
                  <blink>~*~ SAVED ITINERARIES ~*~</blink>
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      {error && (
        <div className="travel-error">
          <font face="Comic Sans MS" size="3" color="#FF00FF">
            {error}
          </font>
        </div>
      )}

      {plans === null && (
        <font face="Comic Sans MS" size="3" color="#FFFFFF">
          loading...
        </font>
      )}

      {plans && plans.length === 0 && (
        <table width="100%" cellPadding="14" cellSpacing="0" border="0" className="postbox" bgColor="#000000">
          <tbody>
            <tr>
              <td align="center">
                <font face="Comic Sans MS" size="3" color="#FFFFFF">
                  No saved trips yet. Click <b className="lime">+ NEW TRAVEL PLAN</b> above to add
                  your first itinerary.
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {plans &&
        plans.map((plan) => (
          <div key={plan.id}>
            <table width="100%" cellPadding="10" cellSpacing="0" border="0" className="postbox">
              <tbody>
                <tr valign="top">
                  <td>
                    <Link to={`/travel-plans/${plan.id}`} className="cyan-link">
                      <font face="Impact" size="5" color="#00FFFF">
                        &#9733; {plan.title} &#9733;
                      </font>
                    </Link>
                    <br />
                    <font face="Courier New" size="2" color="#FFFF00">
                      {plan.destination || 'no destination'} &nbsp;&bull;&nbsp; updated{' '}
                      {formatDate(plan.updatedAt)}
                    </font>
                  </td>
                </tr>
              </tbody>
            </table>
            <br />
          </div>
        ))}
    </>
  )
}

const rightSidebar = (
  <>
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
      <tbody>
        <tr>
          <td align="center" bgColor="#FF00FF" className="section-bar-sm">
            <font face="Impact" size="4" color="#FFFF00">
              ~ NAVIGATE ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center">
            <Link to="/" className="navbtn-link">
              &#9733; BACK TO HOME &#9733;
            </Link>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgColor="#000000">
      <tbody>
        <tr>
          <td align="center" bgColor="#FFFF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ HOW IT WORKS ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgColor="#000000">
            <font face="Comic Sans MS" size="2" color="#FFFFFF">
              Paste a markdown itinerary (e.g. one Claude generated for you) and the page will
              render it with full Geocities glory. Plans are private to Sacor only.
            </font>
          </td>
        </tr>
      </tbody>
    </table>
  </>
)

export default function TravelPlansPage() {
  const { loading, isSignedIn, isOwner } = useAuth()

  const mainContent = (
    <>
      <center>
        <font face="Impact" size="6" color="#00FFFF" className="hero-glow">
          &#9733; TRAVEL PLANS &#9733;
        </font>
        <br />
        <font face="Comic Sans MS" size="3" color="#FFFF00">
          <blink>~ Sacor&rsquo;s private itinerary stash ~</blink>
        </font>
      </center>

      <br />

      {isOwner ? <PlansList /> : <GatedMessage loading={loading} isSignedIn={isSignedIn} />}
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
