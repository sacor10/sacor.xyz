import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../Layout'
import MarkdownView from '../components/MarkdownView'
import ItineraryMap from '../components/ItineraryMap'
import TravelItineraryEditor from '../components/TravelItineraryEditor'
import TravelStopsEditor from '../components/TravelStopsEditor'
import { normalizeStopsForSave, stopsToDraft } from '../components/travelStops'
import { useAuth } from '../auth/useAuth'

const mapsUrl = (stop) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.name)}&center=${stop.lat},${stop.lng}`

const formatDate = (iso) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const slugifyTitle = (title) => {
  const slug = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'travel-plan'
}

const downloadPlanAsJson = (plan) => {
  const payload = {
    title: plan.title,
    destination: plan.destination || '',
    body: plan.body || '',
    stops: Array.isArray(plan.stops) ? plan.stops : [],
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugifyTitle(plan.title)}.travel-plan.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const planQuery = (id, ownerHash) => {
  const params = new URLSearchParams({ id })
  if (ownerHash) params.set('owner', ownerHash)
  return params.toString()
}

const buildPromptFromPlan = (plan) => {
  const example = {
    title: plan.title,
    destination: plan.destination,
    body: plan.body,
    stops: Array.isArray(plan.stops) ? plan.stops : [],
  }
  return `You are generating a travel itinerary that will be pasted into a Travel Plans tool. Output ONLY a single JSON object matching the schema below — no markdown fencing, no commentary, no preamble.

SCHEMA
{
  "title": string (1-200 chars; short, evocative),
  "destination": string (e.g. "San Francisco, CA"),
  "body": string (full itinerary as markdown — overview, sections, narrative; can use headings, lists, links),
  "stops": [
    {
      "name": string (REQUIRED, max 200 chars),
      "lat": number (REQUIRED, -90..90),
      "lng": number (REQUIRED, -180..180),
      "arrivalTime": string (optional, e.g. "9:30 AM"),
      "durationMinutes": number (optional),
      "notes": string (optional, max 1000 chars)
    }
  ]
}

RULES
- "stops" must be in visit order.
- The "body" markdown should reference the stops by name so the rendered page reads naturally.
- Coordinates must be real and accurate — do not invent locations or guess at lat/lng.
- "title" and "destination" should match the trip described.
- Output JSON only. The first character of your response must be \`{\` and the last must be \`}\`.

EXAMPLE (a complete plan in the exact target shape):

${JSON.stringify(example, null, 2)}

NEW PLAN REQUEST
Generate a plan for: <DESCRIBE YOUR TRIP HERE — e.g. "a 2-day food-focused trip to Lisbon">`
}

function EditForm({ plan, ownerHash, onCancel, onSaved }) {
  const [title, setTitle] = useState(plan.title || '')
  const [destination, setDestination] = useState(plan.destination || '')
  const [body, setBody] = useState(plan.body || '')
  const [stops, setStops] = useState(stopsToDraft(plan.stops))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    let parsedStops = null
    try {
      parsedStops = normalizeStopsForSave(stops)
    } catch (err) {
      setError(err.message)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(
        `/.netlify/functions/travel-plans?${planQuery(plan.id, ownerHash)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            title,
            destination,
            body,
            stops: parsedStops,
            version: plan.version,
          }),
        },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 409) {
          throw new Error(data.error || 'This plan changed while you were editing. Reload and try again.')
        }
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
    <table width="100%" cellPadding="10" cellSpacing="0" border="0" className="postbox travel-form" bgcolor="#000000">
      <tbody>
        <tr>
          <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
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
              <TravelItineraryEditor value={body} onChange={setBody} />
              <br />
              <TravelStopsEditor stops={stops} onChange={setStops} />
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

function SharePanel({ plan }) {
  const [state, setState] = useState({ collaborators: [], contacts: [] })
  const [emails, setEmails] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/.netlify/functions/travel-plan-sharing?id=${encodeURIComponent(plan.id)}`,
          { credentials: 'same-origin' },
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `Share info failed (${res.status})`)
        if (cancelled) return
        setState({
          collaborators: data.collaborators || [],
          contacts: data.contacts || [],
        })
        setError('')
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [plan.id])

  const addContactToBox = (email) => {
    const existing = emails.trim()
    setEmails(existing ? `${existing}\n${email}` : email)
  }

  const handleShare = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')
    setError('')
    try {
      const res = await fetch(
        `/.netlify/functions/travel-plan-sharing?id=${encodeURIComponent(plan.id)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ emails }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Share failed (${res.status})`)
      setState({
        collaborators: data.collaborators || [],
        contacts: data.contacts || [],
      })
      const results = data.results || []
      const shared = results.filter((r) => r.status === 'shared')
      const already = results.filter((r) => r.status === 'already_shared')
      const failedMail = results.filter((r) => r.status === 'shared' && r.emailStatus === 'failed')
      const invalid = results.filter((r) => r.status === 'invalid' || r.status === 'self')
      const parts = []
      if (shared.length > 0) parts.push(`Shared with ${shared.length} account(s).`)
      if (already.length > 0) parts.push(`${already.length} already had access.`)
      if (failedMail.length > 0) {
        const reasons = [...new Set(failedMail.map((r) => r.error).filter(Boolean))]
        const reasonText = reasons.length > 0 ? ` Reason: ${reasons.join('; ')}.` : ''
        parts.push(`${failedMail.length} invite email(s) failed, but access was granted.${reasonText}`)
      }
      if (invalid.length > 0) parts.push(`${invalid.length} address(es) skipped.`)
      setMessage(parts.join(' ') || 'No changes made.')
      if (shared.length > 0) setEmails('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const removeCollaborator = async (email) => {
    if (!window.confirm(`Remove access for ${email}?`)) return
    setMessage('')
    setError('')
    try {
      const res = await fetch(
        `/.netlify/functions/travel-plan-sharing?id=${encodeURIComponent(plan.id)}&email=${encodeURIComponent(email)}`,
        { method: 'DELETE', credentials: 'same-origin' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Remove failed (${res.status})`)
      setState({
        collaborators: data.collaborators || [],
        contacts: data.contacts || [],
      })
      setMessage(`Removed access for ${email}.`)
    } catch (err) {
      setError(err.message)
    }
  }

  const removeContact = async (email) => {
    setMessage('')
    setError('')
    try {
      const res = await fetch(
        `/.netlify/functions/travel-plan-sharing?contact=${encodeURIComponent(email)}`,
        { method: 'DELETE', credentials: 'same-origin' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Remove contact failed (${res.status})`)
      setState((current) => ({ ...current, contacts: data.contacts || [] }))
      setMessage(`Removed ${email} from saved contacts.`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <table width="100%" cellPadding="10" cellSpacing="0" border="0" className="postbox travel-form" bgcolor="#000000">
      <tbody>
        <tr>
          <td align="center" bgcolor="#00FF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ SHARE THIS PLAN ~
            </font>
          </td>
        </tr>
        <tr>
          <td>
            <font face="Comic Sans MS" size="2" color="#FFFFFF">
              Add Google account email addresses. People you share with can edit this same saved plan.
            </font>
            <br />
            <br />
            {loading ? (
              <font face="Comic Sans MS" size="2" color="#FFFFFF">
                loading share info...
              </font>
            ) : (
              <>
                <form onSubmit={handleShare}>
                  <label className="travel-label">
                    <font face="Impact" size="3" color="#FFFF00">
                      EMAILS
                    </font>
                    <textarea
                      value={emails}
                      rows={4}
                      onChange={(e) => setEmails(e.target.value)}
                      placeholder="friend@gmail.com, cousin@example.com"
                    />
                  </label>
                  <center>
                    <button type="submit" className="dl-btn" disabled={submitting}>
                      {submitting ? 'SHARING...' : 'SHARE PLAN'}
                    </button>
                  </center>
                </form>

                {state.contacts.length > 0 && (
                  <>
                    <br />
                    <font face="Impact" size="3" color="#FFFF00">
                      SAVED CONTACTS
                    </font>
                    <div className="share-chip-row">
                      {state.contacts.map((email) => (
                        <span key={email} className="share-chip">
                          <button type="button" onClick={() => addContactToBox(email)}>
                            {email}
                          </button>
                          <button type="button" aria-label={`Remove ${email}`} onClick={() => removeContact(email)}>
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  </>
                )}

                <br />
                <font face="Impact" size="3" color="#FFFF00">
                  COLLABORATORS
                </font>
                {state.collaborators.length === 0 ? (
                  <div>
                    <font face="Comic Sans MS" size="2" color="#FFFFFF">
                      Nobody else has access yet.
                    </font>
                  </div>
                ) : (
                  <div className="share-list">
                    {state.collaborators.map((email) => (
                      <div key={email} className="share-row">
                        <font face="Courier New" size="2" color="#00FF00">
                          {email}
                        </font>
                        <button type="button" className="mini-btn" onClick={() => removeCollaborator(email)}>
                          REMOVE
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {message && (
              <div className="travel-note">
                <font face="Comic Sans MS" size="2" color="#FFFF00">
                  {message}
                </font>
              </div>
            )}
            {error && (
              <div className="travel-error">
                <font face="Comic Sans MS" size="2" color="#FF00FF">
                  {error}
                </font>
              </div>
            )}
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
          <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
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
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { loading: authLoading, canAccessTravelPlans } = useAuth()
  const [result, setResult] = useState(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')

  const ownerHashParam = searchParams.get('owner') || ''
  const plan = result?.plan ?? null
  const fetchError = result?.error ?? ''
  const loading = canAccessTravelPlans && result === null

  useEffect(() => {
    if (authLoading || !canAccessTravelPlans) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/.netlify/functions/travel-plans?${planQuery(id, ownerHashParam)}`,
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
  }, [id, ownerHashParam, authLoading, canAccessTravelPlans])

  const handleDelete = async () => {
    if (!window.confirm('Delete this travel plan? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(
        `/.netlify/functions/travel-plans?${planQuery(id, ownerHashParam)}`,
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
      <table width="100%" cellPadding="14" cellSpacing="0" border="0" className="postbox" bgcolor="#000000">
        <tbody>
          <tr>
            <td align="center">
              <font face="Comic Sans MS" size="3" color="#FFFFFF">
                Sign in with Google to view your travel plans.
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
        ownerHash={ownerHashParam || (plan.isShared ? plan.ownerHash : '')}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          setResult({ plan: updated })
          setEditing(false)
        }}
      />
    )
  } else {
    const hasStops = Array.isArray(plan.stops) && plan.stops.length > 0
    body = (
      <>
        {hasStops && (
          <>
            <table width="100%" cellPadding="14" cellSpacing="0" border="0" className="postbox" bgcolor="#000000">
              <tbody>
                <tr>
                  <td>
                    <ItineraryMap stops={plan.stops} />
                  </td>
                </tr>
              </tbody>
            </table>
            <br />
            <table width="100%" cellPadding="0" cellSpacing="0" border="0" className="postbox" bgcolor="#000000">
              <tbody>
                <tr>
                  <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
                    <font face="Impact" size="4" color="#FFFF00">
                      ~ STOPS ~
                    </font>
                  </td>
                </tr>
                {plan.stops.map((stop, i) => (
                  <tr key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid #333' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <font face="Impact" size="3" color="#c0392b">{i + 1}.&nbsp;</font>
                      <a href={mapsUrl(stop)} target="_blank" rel="noopener noreferrer" className="cyan-link">
                        <font face="Impact" size="3">{stop.name}</font>
                      </a>
                      {(stop.arrivalTime || stop.durationMinutes) && (
                        <span>
                          &nbsp;&nbsp;
                          <font face="Comic Sans MS" size="2" color="#FFFF00">
                            {stop.arrivalTime}
                            {stop.arrivalTime && stop.durationMinutes && ' · '}
                            {stop.durationMinutes && `${stop.durationMinutes} min`}
                          </font>
                        </span>
                      )}
                      {stop.notes && (
                        <>
                          <br />
                          <font face="Comic Sans MS" size="2" color="#AAAAAA">{stop.notes}</font>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <br />
          </>
        )}
        <table width="100%" cellPadding="14" cellSpacing="0" border="0" className="postbox" bgcolor="#000000">
          <tbody>
            <tr>
              <td>
                <font face="Courier New" size="2" color="#FFFF00">
                  {plan.destination || 'no destination'} &nbsp;&bull;&nbsp; updated{' '}
                  {formatDate(plan.updatedAt)}
                  {plan.updatedBy && (
                    <>
                      {' '}
                      by {plan.updatedBy}
                    </>
                  )}
                </font>
                {plan.isShared && (
                  <>
                    <br />
                    <font face="Comic Sans MS" size="2" color="#00FF00">
                      shared by {plan.ownerEmail}
                    </font>
                  </>
                )}
                {plan.isOwner && plan.collaboratorCount > 0 && (
                  <>
                    <br />
                    <font face="Comic Sans MS" size="2" color="#00FF00">
                      shared with {plan.collaboratorCount} collaborator(s)
                    </font>
                  </>
                )}
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
          {plan.isOwner && (
            <>
              &nbsp;&nbsp;
              <button
                type="button"
                className="navbtn-link"
                onClick={handleDelete}
                disabled={deleting}
              >
                &#9733; {deleting ? 'DELETING...' : 'DELETE'} &#9733;
              </button>
            </>
          )}
          &nbsp;&nbsp;
          <button
            type="button"
            className="navbtn-link"
            onClick={() => downloadPlanAsJson(plan)}
          >
            &#9733; EXPORT AS JSON &#9733;
          </button>
          &nbsp;&nbsp;
          <button
            type="button"
            className="navbtn-link"
            onClick={() => {
              setCopyStatus('')
              setExportOpen((v) => !v)
            }}
          >
            &#9733; {exportOpen ? 'HIDE PROMPT' : 'EXPORT AS PROMPT'} &#9733;
          </button>
          {plan.isOwner && (
            <>
              &nbsp;&nbsp;
              <button
                type="button"
                className="navbtn-link"
                onClick={() => setShareOpen((v) => !v)}
              >
                &#9733; {shareOpen ? 'HIDE SHARE' : 'SHARE'} &#9733;
              </button>
            </>
          )}
        </center>
        {deleteError && (
          <center>
            <font face="Comic Sans MS" size="2" color="#FF00FF">
              {deleteError}
            </font>
          </center>
        )}
        {shareOpen && plan.isOwner && (
          <>
            <br />
            <SharePanel plan={plan} />
          </>
        )}
        {exportOpen && (() => {
          const promptText = buildPromptFromPlan(plan)
          const handleCopy = async () => {
            try {
              await navigator.clipboard.writeText(promptText)
              setCopyStatus('Copied to clipboard!')
            } catch {
              setCopyStatus('Copy failed — select the text and copy manually.')
            }
          }
          return (
            <>
              <br />
              <table width="100%" cellPadding="10" cellSpacing="0" border="0" className="postbox travel-form" bgcolor="#000000">
                <tbody>
                  <tr>
                    <td align="center" bgcolor="#00FFFF" className="section-bar-sm">
                      <font face="Impact" size="4" color="#000000">
                        ~ AI PROMPT (PASTE INTO CLAUDE / CHATGPT) ~
                      </font>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <font face="Comic Sans MS" size="2" color="#FFFFFF">
                        Copy this prompt, replace the trip description at the bottom, and use IMPORT FROM JSON on the Travel Plans page for the full response. To update map stops only, paste the response's stops array into Advanced JSON.
                      </font>
                      <br />
                      <br />
                      <textarea
                        value={promptText}
                        readOnly
                        rows={18}
                        onFocus={(e) => e.target.select()}
                      />
                      <br />
                      <br />
                      <center>
                        <button type="button" className="dl-btn" onClick={handleCopy}>
                          COPY PROMPT
                        </button>
                        {copyStatus && (
                          <>
                            &nbsp;&nbsp;
                            <font face="Comic Sans MS" size="2" color="#FFFF00">
                              {copyStatus}
                            </font>
                          </>
                        )}
                      </center>
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )
        })()}
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
