import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../Layout'
import { useAuth } from '../auth/useAuth'
import GoogleSignInButton from '../auth/GoogleSignInButton'

const API = '/.netlify/functions/guestbook'

const inputStyle = {
  background: '#000000',
  color: '#00FF00',
  border: '2px inset #808080',
  fontFamily: '"Courier New", monospace',
  fontSize: '14px',
  padding: '4px 6px',
  width: '100%',
  boxSizing: 'border-box',
}

function formatDate(createdAt) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return createdAt
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function SignHereBox({ onSigned }) {
  const { user, isSignedIn } = useAuth()
  // null = untouched; default the visible value to the email's local part
  const [nameEdit, setNameEdit] = useState(null)
  const [location, setLocation] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState(null) // { kind: 'error' | 'ok', text }
  const [submitting, setSubmitting] = useState(false)

  const name = nameEdit ?? (user?.email || '').split('@')[0]

  async function submit(e) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setStatus(null)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name, location, message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus({ kind: 'error', text: data.error || `Something broke (HTTP ${res.status})` })
        return
      }
      onSigned(data.entry)
      setMessage('')
      setStatus({ kind: 'ok', text: 'Your entry is now part of history!!!' })
    } catch {
      setStatus({ kind: 'error', text: 'Network error — try again in a sec.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <center>
      <table width="100%" cellPadding="12" cellSpacing="0" border="0" className="postbox" bgcolor="#000000">
        <tbody>
          <tr>
            <td align="center" bgcolor="#00FF00" className="section-bar-sm">
              <font face="Impact" size="5" color="#000000">
                <span className="blink">~*~ SIGN HERE ~*~</span>
              </font>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#000000">
              {!isSignedIn ? (
                <>
                  <br />
                  <font face="Comic Sans MS" size="3" color="#FFFFFF">
                    You must <b className="cyan">sign in with Google</b> to sign the guestbook.
                    <br />
                    Real notes from real people only!!!
                  </font>
                  <br />
                  <br />
                  <GoogleSignInButton />
                  <br />
                </>
              ) : (
                <form onSubmit={submit} style={{ margin: 0, textAlign: 'left' }}>
                  <br />
                  <font face="Comic Sans MS" size="2" color="#FFFF00">
                    Your name (as shown publicly):
                  </font>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setNameEdit(e.target.value)}
                    maxLength={40}
                    required
                    style={inputStyle}
                  />
                  <br />
                  <br />
                  <font face="Comic Sans MS" size="2" color="#FFFF00">
                    Location (real or fake, optional):
                  </font>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    maxLength={60}
                    placeholder="somewhere cool"
                    style={inputStyle}
                  />
                  <br />
                  <br />
                  <font face="Comic Sans MS" size="2" color="#FFFF00">
                    Your message for all of posterity:
                  </font>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={500}
                    required
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                  <br />
                  <br />
                  <center>
                    <button type="submit" className="navbtn-link" disabled={submitting} style={{ cursor: 'pointer' }}>
                      {submitting ? '... CHISELING ...' : '★ SIGN THE GUESTBOOK ★'}
                    </button>
                  </center>
                  <br />
                </form>
              )}
              {status && (
                <>
                  <font face="Comic Sans MS" size="2" color={status.kind === 'error' ? '#FF6699' : '#00FF00'}>
                    {status.text}
                  </font>
                  <br />
                  <br />
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </center>
  )
}

export default function GuestbookPage() {
  const { isOwner } = useAuth()
  const [entries, setEntries] = useState([])
  const [count, setCount] = useState(0)
  const [loadState, setLoadState] = useState('loading') // loading | ready | error

  useEffect(() => {
    let cancelled = false
    fetch(API)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return
        setEntries(data.entries || [])
        setCount(data.count || 0)
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleSigned(entry) {
    if (!entry) return
    setEntries((prev) => [entry, ...prev])
    setCount((prev) => prev + 1)
  }

  async function handleDelete(id) {
    const res = await fetch(`${API}?id=${id}`, { method: 'DELETE', credentials: 'same-origin' })
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id))
      setCount((prev) => Math.max(0, prev - 1))
    }
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
              <Link to="/" className="navbtn-link">&#9733; BACK TO HOME &#9733;</Link>
              <br />
              <br />
              <Link to="/contact" className="navbtn-link">&#9733; CONTACT ME &#9733;</Link>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <table
        width="100%"
        cellPadding="8"
        cellSpacing="0"
        border="0"
        className="bevelbox"
        bgcolor="#000000"
      >
        <tbody>
          <tr>
            <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">
                ~ HOUSE RULES ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#FFFFFF">
                <ol style={{ paddingLeft: '18px', margin: 0 }}>
                  <li>Be kind!</li>
                  <li>No spam!</li>
                  <li>No crypto!</li>
                  <li>Nothing but American excellence is encouraged here!</li>
                  <li>Have a good time and enjoy it too.</li>
                </ol>
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <table
        width="100%"
        cellPadding="8"
        cellSpacing="0"
        border="0"
        className="bevelbox"
        bgcolor="#4B0082"
      >
        <tbody>
          <tr>
            <td align="center" bgcolor="#00FFFF" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">
                ~ STATS ~
              </font>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#000000">
              <font face="Courier New" size="2" color="#00FF00">
                <b className="yellow">Total signatures:</b> {count}
                <br />
                <b className="yellow">Spam filtered:</b> 2,841
                <br />
                <b className="yellow">Crypto bots and bros blocked:</b> <span className="blink">&infin;</span>
                <br />
                <b className="yellow">Vibes:</b> immaculate
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )

  const mainContent = (
    <>
      <center>
        <font face="Impact" size="6" color="#00FFFF" className="hero-glow">
          &#9733; SIGN MY GUESTBOOK &#9733;
        </font>
        <br />
        <font face="Comic Sans MS" size="3" color="#FFFF00">
          <span className="blink">~ Leave a message for all of posterity! ~</span>
        </font>
      </center>

      <br />

      <font face="Comic Sans MS" size="3" color="#FFFFFF">
        Welcome to the <b className="hotpink">Sacor.xyz Guestbook</b>, established in{' '}
        <b className="cyan">1989</b> (spiritually). Below you will find the sacred scrolls of
        everyone who has ever stopped by to say hi. These are <b className="cyan">real notes from
        real people</b> &mdash; sign in with Google and add yours below.
      </font>

      <br />
      <br />

      <SignHereBox onSigned={handleSigned} />

      <br />

      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td align="center" bgcolor="#FF00FF" className="section-bar">
                <font face="Impact" size="5" color="#FFFF00">
                  <span className="blink">~*~ ENTRIES ~*~</span>
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      {loadState === 'loading' && (
        <center>
          <font face="Courier New" size="3" color="#00FF00">
            <span className="blink">loading the sacred scrolls...</span>
          </font>
          <br />
          <br />
        </center>
      )}

      {loadState === 'error' && (
        <center>
          <font face="Comic Sans MS" size="3" color="#FF6699">
            The guestbook machine is broken!!! Try refreshing.
          </font>
          <br />
          <br />
        </center>
      )}

      {loadState === 'ready' && entries.length === 0 && (
        <center>
          <font face="Comic Sans MS" size="3" color="#FFFFFF">
            No entries yet... <b className="cyan">be the first to sign!</b>
          </font>
          <br />
          <br />
        </center>
      )}

      {entries.map((entry) => (
        <div key={entry.id}>
          <table
            width="100%"
            cellPadding="8"
            cellSpacing="0"
            border="0"
            className="postbox"
            style={{ borderLeft: `6px solid ${entry.color}` }}
          >
            <tbody>
              <tr valign="top">
                <td>
                  <font face="Impact" size="4" color={entry.color}>
                    {entry.name}
                  </font>
                  {isOwner && (
                    <button
                      type="button"
                      className="signout-btn"
                      style={{ float: 'right' }}
                      onClick={() => handleDelete(entry.id)}
                      title="Delete entry"
                    >
                      &#10005;
                    </button>
                  )}
                  <br />
                  <font face="Courier New" size="2" color="#FFFF00">
                    {formatDate(entry.created_at)}
                    {entry.location ? <> &nbsp;&bull;&nbsp; {entry.location}</> : null}
                  </font>
                  <br />
                  <br />
                  <font face="Comic Sans MS" size="3" color="#FFFFFF">
                    {entry.message}
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

  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
