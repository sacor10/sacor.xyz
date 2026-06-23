import { useState } from 'react'

function groupedCatalog(catalog, groups) {
  const labels = new Map(groups.map((group) => [group.id, group.name]))
  const buckets = new Map()
  for (const interest of catalog) {
    const id = interest.group || 'other'
    if (!buckets.has(id)) buckets.set(id, { id, name: labels.get(id) || 'More', interests: [] })
    buckets.get(id).interests.push(interest)
  }
  const ordered = groups
    .map((group) => buckets.get(group.id))
    .filter(Boolean)
  const extras = [...buckets.values()].filter((group) => !groups.some((item) => item.id === group.id))
  return [...ordered, ...extras]
}

export default function SubmitSiteModal({ catalog, groups, onClose, onSubmit }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const toggle = (slug) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!url.trim()) {
      setError('Paste a URL to submit.')
      return
    }
    setBusy(true)
    try {
      await onSubmit({
        url: url.trim(),
        title: title.trim(),
        note: note.trim(),
        interests: [...selected],
      })
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Could not submit that site.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="su-overlay" role="dialog" aria-modal="true" aria-label="Submit a site">
      <div className="su-dialog su-submit-dialog">
        <button type="button" className="su-modal-close" onClick={onClose} aria-label="Close">
          x
        </button>

        {submitted ? (
          <>
            <h2>Site submitted</h2>
            <p>Thanks. It is queued for moderation and will stay out of the live pool until approved.</p>
            <div className="su-dialog-footer">
              <span className="su-dialog-hint">Pending review</span>
              <button type="button" className="su-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2>Submit a site</h2>
            <p>Share a safe, interesting corner of the web for future stumbles.</p>

            <label className="su-field">
              <span>URL</span>
              <input
                className="su-input"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/weird-useful-thing"
                required
              />
            </label>

            <label className="su-field">
              <span>Title override</span>
              <input
                className="su-input"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={140}
                placeholder="Optional"
              />
            </label>

            <label className="su-field">
              <span>Moderator note</span>
              <textarea
                className="su-input su-textarea"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder="What makes it worth stumbling?"
              />
            </label>

            {catalog.length > 0 && (
              <div className="su-submit-topics">
                <h3>Topics</h3>
                {groupedCatalog(catalog, groups).map((group) => (
                  <section key={group.id} className="su-interest-group" aria-label={group.name}>
                    <h3>{group.name}</h3>
                    <div className="su-chip-grid">
                      {group.interests.map((interest) => (
                        <button
                          key={interest.slug}
                          type="button"
                          className="su-chip"
                          aria-pressed={selected.has(interest.slug)}
                          onClick={() => toggle(interest.slug)}
                        >
                          {interest.name}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {error && <div className="su-form-error">{error}</div>}

            <div className="su-dialog-footer">
              <span className="su-dialog-hint">{selected.size} topics selected</span>
              <button type="submit" className="su-primary" disabled={busy}>
                {busy ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
