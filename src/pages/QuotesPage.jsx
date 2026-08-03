import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../Layout'
import { useAuth } from '../auth/useAuth'
import GoogleSignInButton from '../auth/GoogleSignInButton'

const API = '/.netlify/functions/quotes'

function QuoteMeta({ quote }) {
  const bits = [quote.speaker, quote.date, quote.source].filter(Boolean)
  if (bits.length === 0) return null

  return (
    <font face="Courier New" size="2" color="#FFFF00">
      {bits.map((bit, index) => (
        <span key={`${quote.id}-${bit}`}>
          {index > 0 && <> &nbsp;&bull;&nbsp; </>}
          {bit}
        </span>
      ))}
    </font>
  )
}

function QuoteTags({ quote }) {
  if (!quote.tags?.length) return null

  return (
    <>
      <br />
      <br />
      <font face="Courier New" size="2" color="#00FF00">
        {quote.tags.map((tag) => (
          <span key={tag}>[{tag}] </span>
        ))}
      </font>
    </>
  )
}

const emptyForm = { text: '', speaker: '', date: '', source: '', context: '', link: '', tags: '', pinned: false }

const formFromQuote = (quote) => ({
  text: quote.text || '',
  speaker: quote.speaker || '',
  date: quote.date || '',
  source: quote.source || '',
  context: quote.context || '',
  link: quote.link || '',
  tags: (quote.tags || []).join(', '),
  pinned: !!quote.pinned,
})

function QuoteForm({ initial = emptyForm, submitLabel, busyLabel, onCancel, onSubmit }) {
  const [form, setForm] = useState(initial)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.text.trim()) {
      setError('Quote text is required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        text: form.text.trim(),
        speaker: form.speaker.trim(),
        date: form.date.trim(),
        source: form.source.trim(),
        context: form.context.trim(),
        link: form.link.trim(),
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        pinned: !!form.pinned,
      }
      await onSubmit(payload)
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
          <td>
            <form onSubmit={handleSubmit} method="post">
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  QUOTE TEXT
                </font>
                <textarea value={form.text} onChange={set('text')} maxLength={4000} required rows={4} />
              </label>
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  SPEAKER
                </font>
                <input type="text" value={form.speaker} onChange={set('speaker')} maxLength={120} />
              </label>
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  DATE
                </font>
                <input type="text" value={form.date} onChange={set('date')} maxLength={60} placeholder="e.g. February 1824" />
              </label>
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  SOURCE
                </font>
                <input type="text" value={form.source} onChange={set('source')} maxLength={120} />
              </label>
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  CONTEXT
                </font>
                <textarea value={form.context} onChange={set('context')} maxLength={2000} rows={3} />
              </label>
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  LINK
                </font>
                <input type="text" value={form.link} onChange={set('link')} maxLength={500} placeholder="https://..." />
              </label>
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  TAGS (comma-separated)
                </font>
                <input type="text" value={form.tags} onChange={set('tags')} placeholder="home-page-classic, funny" />
              </label>
              <label className="travel-label">
                <font face="Impact" size="3" color="#FFFF00">
                  <input type="checkbox" checked={form.pinned} onChange={set('pinned')} /> PINNED
                </font>
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
                  {submitting ? busyLabel : submitLabel}
                </button>
                &nbsp;&nbsp;
                <button type="button" className="navbtn-link" onClick={onCancel} disabled={submitting}>
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

function NewQuoteForm({ onCreated }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <center>
        <button type="button" className="dl-btn" onClick={() => setOpen(true)}>
          + NEW QUOTE
        </button>
      </center>
    )
  }

  return (
    <QuoteForm
      submitLabel="SAVE QUOTE"
      busyLabel="SAVING..."
      onCancel={() => setOpen(false)}
      onSubmit={async (payload) => {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`)
        onCreated(data.quote)
        setOpen(false)
      }}
    />
  )
}

function QuoteCard({ quote, featured = false, canEdit, editing, onEdit, onCancelEdit, onSaved, onDelete }) {
  if (editing) {
    return (
      <QuoteForm
        initial={formFromQuote(quote)}
        submitLabel="SAVE CHANGES"
        busyLabel="SAVING..."
        onCancel={onCancelEdit}
        onSubmit={async (payload) => {
          const res = await fetch(`${API}?id=${encodeURIComponent(quote.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`)
          onSaved(data.quote)
        }}
      />
    )
  }

  return (
    <table
      width="100%"
      cellPadding="10"
      cellSpacing="0"
      border="0"
      className="postbox"
      style={{ borderLeft: `6px solid ${featured ? '#FFFF00' : '#00FFFF'}` }}
    >
      <tbody>
        <tr valign="top">
          <td>
            <font face="Impact" size="4" color={featured ? '#FFFF00' : '#00FFFF'}>
              {featured ? '~ PINNED QUOTE ~' : '~ ARCHIVE QUOTE ~'}
            </font>
            {canEdit && (
              <span style={{ float: 'right' }}>
                <button type="button" className="mini-btn" onClick={onEdit}>
                  EDIT
                </button>
                &nbsp;
                <button type="button" className="mini-btn" onClick={onDelete}>
                  DELETE
                </button>
              </span>
            )}
            <br />
            <QuoteMeta quote={quote} />
            <br />
            <br />
            <font face="Comic Sans MS" size="4" color="#FFFFFF">
              <span style={{ display: 'block', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                &quot;{quote.text}&quot;
              </span>
            </font>
            {quote.context && (
              <>
                <br />
                <br />
                <font face="Comic Sans MS" size="2" color="#CCCCCC">
                  <i>{quote.context}</i>
                </font>
              </>
            )}
            <QuoteTags quote={quote} />
            {quote.link && (
              <>
                <br />
                <br />
                <font face="Comic Sans MS" size="2">
                  <a href={quote.link} target="_blank" rel="noopener noreferrer">
                    Source Link &rarr;
                  </a>
                </font>
              </>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function QuoteList({ items, featured = false, emptyText, canEdit, editingId, onEdit, onCancelEdit, onSaved, onDelete }) {
  if (items.length === 0) {
    return (
      <table width="100%" cellPadding="10" cellSpacing="0" border="0" className="postbox">
        <tbody>
          <tr>
            <td align="center">
              <font face="Comic Sans MS" size="3" color="#FFFF00">
                <span className="blink">{emptyText}</span>
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    )
  }

  return items.map((quote) => (
    <div key={quote.id}>
      <QuoteCard
        quote={quote}
        featured={featured}
        canEdit={canEdit}
        editing={editingId === quote.id}
        onEdit={() => onEdit(quote.id)}
        onCancelEdit={onCancelEdit}
        onSaved={(updated) => onSaved(quote.id, updated)}
        onDelete={() => onDelete(quote.id)}
      />
      <br />
    </div>
  ))
}

function SignInGate({ loading }) {
  return (
    <table width="100%" cellPadding="14" cellSpacing="0" border="0" className="postbox" bgcolor="#000000">
      <tbody>
        <tr>
          <td align="center">
            <font face="Impact" size="5" color="#FF00FF">
              ~ SIGN IN TO READ THE QUOTES ~
            </font>
            <br />
            <br />
            <font face="Comic Sans MS" size="3" color="#FFFFFF">
              {loading
                ? 'checking your session...'
                : 'Sign in with Google in the top banner to view the quote catalog.'}
            </font>
            {!loading && (
              <>
                <br />
                <br />
                <GoogleSignInButton />
              </>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export default function QuotesPage() {
  const { loading, isSignedIn, isQuotesAdmin } = useAuth()
  const [quotes, setQuotes] = useState([])
  const [canEdit, setCanEdit] = useState(false)
  const [loadState, setLoadState] = useState('loading') // loading | ready | error
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    if (loading || !isSignedIn) return
    let cancelled = false
    fetch(API, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (cancelled) return
        setQuotes(data.quotes || [])
        setCanEdit(!!data.canEdit)
        setLoadState('ready')
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [loading, isSignedIn])

  const handleCreated = (quote) => {
    setQuotes((prev) => [quote, ...prev])
  }

  const handleSaved = (oldId, updated) => {
    setQuotes((prev) => prev.map((q) => (q.id === oldId ? updated : q)))
    setEditingId(null)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this quote? This cannot be undone.')) return
    const res = await fetch(`${API}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    if (res.ok) {
      setQuotes((prev) => prev.filter((q) => q.id !== id))
    }
  }

  const pinnedQuotes = quotes.filter((q) => q.pinned)
  const olderQuotes = quotes.filter((q) => !q.pinned)
  const allTags = Array.from(new Set(quotes.flatMap((q) => q.tags || [])))
  const editable = canEdit && isQuotesAdmin

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
              <Link to="/guestbook" className="navbtn-link">&#9733; GUESTBOOK &#9733;</Link>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
        <tbody>
          <tr>
            <td align="center" bgcolor="#00FFFF" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">
                ~ QUOTE STATS ~
              </font>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#000000">
              <font face="Courier New" size="2" color="#00FF00">
                <b className="yellow">Total quotes:</b> {quotes.length}
                <br />
                <b className="yellow">Pinned:</b> {pinnedQuotes.length}
                <br />
                <b className="yellow">Older catalog:</b> {olderQuotes.length}
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      {allTags.length > 0 && (
        <>
          <br />
          <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#4B0082">
            <tbody>
              <tr>
                <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
                  <font face="Impact" size="4" color="#000000">
                    ~ TAGS ~
                  </font>
                </td>
              </tr>
              <tr>
                <td bgcolor="#000000">
                  <font face="Courier New" size="2" color="#00FFFF">
                    {allTags.map((tag) => (
                      <span key={tag}>[{tag}] </span>
                    ))}
                  </font>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </>
  )

  const mainContent = (
    <>
      <center>
        <font face="Impact" size="6" color="#00FFFF" className="hero-glow">
          <span className="blink">~*~ QUOTES FROM OTHERS ~*~</span>
        </font>
        <br />
        <font face="Comic Sans MS" size="3" color="#FFFF00">
          Messages and sentences that refused to leave the premises.
        </font>
      </center>

      <br />

      {!isSignedIn ? (
        <SignInGate loading={loading} />
      ) : (
        <>
          {loadState === 'error' && (
            <center>
              <font face="Comic Sans MS" size="3" color="#FF6699">
                Could not load the quotes!!! Try refreshing.
              </font>
              <br />
              <br />
            </center>
          )}

          {loadState === 'loading' && (
            <center>
              <font face="Courier New" size="3" color="#00FF00">
                <span className="blink">loading the archive...</span>
              </font>
              <br />
              <br />
            </center>
          )}

          {loadState === 'ready' && (
            <>
              {editable && (
                <>
                  <NewQuoteForm onCreated={handleCreated} />
                  <br />
                </>
              )}

              <center>
                <table width="100%" cellPadding="0" cellSpacing="0" border="0">
                  <tbody>
                    <tr>
                      <td align="center" bgcolor="#FF00FF" className="section-bar">
                        <font face="Impact" size="5" color="#FFFF00">
                          <span className="blink">~ PINNED ~</span>
                        </font>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </center>

              <br />

              <QuoteList
                items={pinnedQuotes}
                featured
                emptyText="NO PINNED QUOTES YET!!!"
                canEdit={editable}
                editingId={editingId}
                onEdit={setEditingId}
                onCancelEdit={() => setEditingId(null)}
                onSaved={handleSaved}
                onDelete={handleDelete}
              />

              <center>
                <table width="100%" cellPadding="0" cellSpacing="0" border="0">
                  <tbody>
                    <tr>
                      <td align="center" bgcolor="#00FFFF" className="section-bar">
                        <font face="Impact" size="5" color="#000000">
                          ~ OLDER QUOTE CATALOG ~
                        </font>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </center>

              <br />

              <QuoteList
                items={olderQuotes}
                emptyText="NO OLDER QUOTES HAVE ESCAPED INTO THE ARCHIVE YET!!!"
                canEdit={editable}
                editingId={editingId}
                onEdit={setEditingId}
                onCancelEdit={() => setEditingId(null)}
                onSaved={handleSaved}
                onDelete={handleDelete}
              />
            </>
          )}
        </>
      )}
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
