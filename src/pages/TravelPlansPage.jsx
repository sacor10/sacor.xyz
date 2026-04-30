import { useEffect, useRef, useState } from 'react'
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

function GatedMessage({ loading }) {
  return (
    <table width="100%" cellPadding="14" cellSpacing="0" border="0" className="postbox" bgColor="#000000">
      <tbody>
        <tr>
          <td align="center">
            <font face="Impact" size="5" color="#FF00FF">
              ~ SIGN IN TO START PLANNING ~
            </font>
            <br />
            <br />
            <font face="Comic Sans MS" size="3" color="#FFFFFF">
              {loading
                ? 'checking your session...'
                : 'Sign in with Google in the top banner to view and edit your private travel itineraries.'}
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
  const [stopsJson, setStopsJson] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setTitle('')
    setDestination('')
    setBody('')
    setStopsJson('')
    setError('')
  }

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
      const res = await fetch('/.netlify/functions/travel-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ title, destination, body, stops: parsedStops }),
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

function ImportPlanButton({ onImported }) {
  const inputRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setSuccess('')
    setImporting(true)
    try {
      const text = await file.text()
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch (err) {
        throw new Error(`Invalid JSON file: ${err.message}`)
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Import file must be a JSON object.')
      }
      if (typeof parsed.title !== 'string' || !parsed.title.trim()) {
        throw new Error('Import file is missing a "title".')
      }
      const payload = {
        title: parsed.title,
        destination: typeof parsed.destination === 'string' ? parsed.destination : '',
        body: typeof parsed.body === 'string' ? parsed.body : '',
        stops: Array.isArray(parsed.stops) ? parsed.stops : null,
      }
      const res = await fetch('/.netlify/functions/travel-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Import failed (${res.status})`)
      }
      const plan = await res.json()
      setSuccess(`Imported "${plan.title}".`)
      onImported?.(plan)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <center>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        className="dl-btn"
        onClick={() => inputRef.current?.click()}
        disabled={importing}
      >
        {importing ? 'IMPORTING...' : 'IMPORT FROM JSON'}
      </button>
      {error && (
        <div className="travel-error">
          <font face="Comic Sans MS" size="2" color="#FF00FF">
            {error}
          </font>
        </div>
      )}
      {success && (
        <div>
          <font face="Comic Sans MS" size="2" color="#FFFF00">
            {success}
          </font>
        </div>
      )}
    </center>
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

      <ImportPlanButton onImported={load} />

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
              render it with full Geocities glory. Plans are private to your Google account &mdash;
              export and import as JSON to move them between accounts.
            </font>
          </td>
        </tr>
      </tbody>
    </table>
  </>
)

export default function TravelPlansPage() {
  const { loading, canAccessTravelPlans } = useAuth()

  const mainContent = (
    <>
      <center>
        <font face="Impact" size="6" color="#00FFFF" className="hero-glow">
          &#9733; TRAVEL PLANS &#9733;
        </font>
        <br />
        <font face="Comic Sans MS" size="3" color="#FFFF00">
          <blink>~ your private itinerary stash ~</blink>
        </font>
      </center>

      <br />

      {canAccessTravelPlans ? <PlansList /> : <GatedMessage loading={loading} />}
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
