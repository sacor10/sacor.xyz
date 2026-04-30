import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../Layout'
import MarkdownView from '../components/MarkdownView'
import { useAuth } from '../auth/useAuth'

const formatDate = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function EditForm({ plan, onCancel, onSaved }) {
  const [title, setTitle] = useState(plan.title || '')
  const [destination, setDestination] = useState(plan.destination || '')
  const [body, setBody] = useState(plan.body || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(
        `/.netlify/functions/travel-plans?id=${encodeURIComponent(plan.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ title, destination, body }),
        },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Save failed (${res.status})`)
      }
      const updated = await res.json()
      onSaved(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <table width="100%" cellPadding="10" cellSpacing="0" border="0" className="postbox travel-form" bgColor="#000000">
      <tbody>
        <tr>
          <td align="center" bgColor="#FFFF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ EDIT ITINERARY ~
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
                />
              </label>
              <br />
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  ITINERARY (markdown)
                </font>
                <textarea
                  value={body}
                  rows={20}
                  onChange={(e) => setBody(e.target.value)}
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
                  {submitting ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
                &nbsp;&nbsp;
                <button type="button" className="navbtn-link" onClick={onCancel}>
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
            <Link to="/travel-plans" className="navbtn-link">
              &#9733; ALL PLANS &#9733;
            </Link>
            <br />
            <br />
            <Link to="/" className="navbtn-link">
              &#9733; BACK TO HOME &#9733;
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  </>
)

export default function TravelPlanPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { loading: authLoading, canAccessTravelPlans } = useAuth()
  const [result, setResult] = useState(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const plan = result?.plan ?? null
  const fetchError = result?.error ?? ''
  const loading = canAccessTravelPlans && result === null

  useEffect(() => {
    if (authLoading || !canAccessTravelPlans) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/.netlify/functions/travel-plans?id=${encodeURIComponent(id)}`,
          { credentials: 'same-origin' },
        )
        if (!res.ok) throw new Error(`Load failed (${res.status})`)
        const data = await res.json()
        if (!cancelled) setResult({ plan: data })
      } catch (err) {
        if (!cancelled) setResult({ error: err.message })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, authLoading, canAccessTravelPlans])

  const handleDelete = async () => {
    if (!window.confirm('Delete this travel plan? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/.netlify/functions/travel-plans?id=${encodeURIComponent(id)}`,
        { method: 'DELETE', credentials: 'same-origin' },
      )
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      navigate('/travel-plans')
    } catch (err) {
      setDeleteError(err.message)
      setDeleting(false)
    }
  }

  let body
  if (authLoading || loading) {
    body = (
      <font face="Comic Sans MS" size="3" color="#FFFFFF">
        loading...
      </font>
    )
  } else if (!canAccessTravelPlans) {
    body = (
      <table width="100%" cellPadding="14" cellSpacing="0" border="0" className="postbox" bgColor="#000000">
        <tbody>
          <tr>
            <td align="center">
              <font face="Comic Sans MS" size="3" color="#FFFFFF">
                This itinerary is private. Sign in as Sacor to view.
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    )
  } else if (fetchError) {
    body = (
      <font face="Comic Sans MS" size="3" color="#FF00FF">
        {fetchError}
      </font>
    )
  } else if (!plan) {
    body = (
      <font face="Comic Sans MS" size="3" color="#FFFFFF">
        Plan not found.
      </font>
    )
  } else if (editing) {
    body = (
      <EditForm
        plan={plan}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          setResult({ plan: updated })
          setEditing(false)
        }}
      />
    )
  } else {
    body = (
      <>
        <table width="100%" cellPadding="14" cellSpacing="0" border="0" className="postbox" bgColor="#000000">
          <tbody>
            <tr>
              <td>
                <font face="Courier New" size="2" color="#FFFF00">
                  {plan.destination || 'no destination'} &nbsp;&bull;&nbsp; updated{' '}
                  {formatDate(plan.updatedAt)}
                </font>
                <br />
                <br />
                <MarkdownView>{plan.body}</MarkdownView>
              </td>
            </tr>
          </tbody>
        </table>

        <br />

        <center>
          <button type="button" className="navbtn-link" onClick={() => setEditing(true)}>
            &#9733; EDIT &#9733;
          </button>
          &nbsp;&nbsp;
          <button
            type="button"
            className="navbtn-link"
            onClick={handleDelete}
            disabled={deleting}
          >
            &#9733; {deleting ? 'DELETING...' : 'DELETE'} &#9733;
          </button>
        </center>
        {deleteError && (
          <center>
            <font face="Comic Sans MS" size="2" color="#FF00FF">
              {deleteError}
            </font>
          </center>
        )}
      </>
    )
  }

  const mainContent = (
    <>
      <center>
        <font face="Impact" size="6" color="#00FFFF" className="hero-glow">
          {plan ? plan.title : 'TRAVEL PLAN'}
        </font>
      </center>
      <br />
      {body}
      <br />
      <center>
        <Link to="/travel-plans" className="navbtn-link">
          &#9733; BACK TO ALL PLANS &#9733;
        </Link>
      </center>
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
