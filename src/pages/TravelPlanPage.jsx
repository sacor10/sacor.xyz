import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../Layout'
import MarkdownView from '../components/MarkdownView'
import ItineraryMap from '../components/ItineraryMap'
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

function EditForm({ plan, onCancel, onSaved }) {
  const [title, setTitle] = useState(plan.title || '')
  const [destination, setDestination] = useState(plan.destination || '')
  const [body, setBody] = useState(plan.body || '')
  const [stopsJson, setStopsJson] = useState(
    Array.isArray(plan.stops) && plan.stops.length > 0
      ? JSON.stringify(plan.stops, null, 2)
      : '',
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required.')
      return
    }
    let parsedStops = null
    if (stopsJson.trim()) {
      try {
        parsedStops = JSON.parse(stopsJson)
        if (!Array.isArray(parsedStops)) throw new Error('Stops must be a JSON array.')
      } catch (err) {
        setError(`Invalid stops JSON: ${err.message}`)
        return
      }
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
          body: JSON.stringify({ title, destination, body, stops: parsedStops }),
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
              <br />
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  STOPS (JSON, optional)
                </font>
                <textarea
                  value={stopsJson}
                  rows={8}
                  onChange={(e) => setStopsJson(e.target.value)}
                  placeholder='[{"name":"...","lat":37.78,"lng":-122.4}]'
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
  const [exportOpen, setExportOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')

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
    const hasStops = Array.isArray(plan.stops) && plan.stops.length > 0
    body = (
      <>
        {hasStops && (
          <>
            <table width="100%" cellPadding="14" cellSpacing="0" border="0" className="postbox" bgColor="#000000">
              <tbody>
                <tr>
                  <td>
                    <ItineraryMap stops={plan.stops} />
                  </td>
                </tr>
              </tbody>
            </table>
            <br />
            <table width="100%" cellPadding="0" cellSpacing="0" border="0" className="postbox" bgColor="#000000">
              <tbody>
                <tr>
                  <td align="center" bgColor="#FF00FF" className="section-bar-sm">
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
        </center>
        {deleteError && (
          <center>
            <font face="Comic Sans MS" size="2" color="#FF00FF">
              {deleteError}
            </font>
          </center>
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
              <table width="100%" cellPadding="10" cellSpacing="0" border="0" className="postbox travel-form" bgColor="#000000">
                <tbody>
                  <tr>
                    <td align="center" bgColor="#00FFFF" className="section-bar-sm">
                      <font face="Impact" size="4" color="#000000">
                        ~ AI PROMPT (PASTE INTO CLAUDE / CHATGPT) ~
                      </font>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <font face="Comic Sans MS" size="2" color="#FFFFFF">
                        Copy this prompt, replace the trip description at the bottom, and paste the JSON the model returns into the STOPS field of a new plan (the model will also produce title / destination / body — paste those into matching fields).
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
