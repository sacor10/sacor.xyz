import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { stumbleInterests, stumbleInterestGroups } from '../../data/stumbleInterests'
import './stumble.css'

// Mirrors CONTENT_TYPES in netlify/functions/_lib/stumble.mjs.
const CONTENT_TYPES = [
  'archive', 'article', 'audio', 'book', 'collection', 'course', 'gallery',
  'game', 'interactive', 'map', 'museum', 'recipe', 'reference', 'tool', 'video',
]
const FRAME_POLICIES = ['unknown', 'allow', 'block']

function groupedCatalog() {
  const labels = new Map(stumbleInterestGroups.map((group) => [group.id, group.name]))
  const buckets = new Map()
  for (const interest of stumbleInterests) {
    const id = interest.group || 'other'
    if (!buckets.has(id)) buckets.set(id, { id, name: labels.get(id) || 'More', interests: [] })
    buckets.get(id).interests.push(interest)
  }
  return stumbleInterestGroups.map((group) => buckets.get(group.id)).filter(Boolean)
}

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

// One editable pending submission with approve/reject controls.
function PendingCard({ page, onApprove, onReject }) {
  const [title, setTitle] = useState(page.title || '')
  const [description, setDescription] = useState(page.description || '')
  const [interests, setInterests] = useState(() => new Set(page.interests || []))
  const [contentType, setContentType] = useState(page.contentType || 'article')
  const [framePolicy, setFramePolicy] = useState(page.framePolicy || 'unknown')
  const [quality, setQuality] = useState(
    typeof page.qualityScore === 'number' ? page.qualityScore : 0.65,
  )
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggleInterest = (slug) => {
    setInterests((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const run = async (fn) => {
    setError('')
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setError(err.message || 'Action failed.')
      setBusy(false)
    }
  }

  const approve = () =>
    run(() =>
      onApprove(page.id, {
        title: title.trim(),
        description: description.trim(),
        interests: [...interests],
        contentType,
        framePolicy,
        qualityScore: Number(quality),
      }),
    )

  const reject = () => run(() => onReject(page.id, reason.trim()))

  return (
    <div className="su-mod-card">
      <div className="su-mod-card-head">
        <a href={page.url} target="_blank" rel="noopener noreferrer" className="su-mod-url">
          {page.url}
        </a>
        <span className="su-mod-meta">
          {page.domain} · submitted {formatDate(page.submittedAt)}
          {page.submitterUsername ? ` · @${page.submitterUsername}` : ''}
        </span>
      </div>

      {page.submitterNote && <p className="su-mod-note">“{page.submitterNote}”</p>}

      <label className="su-field">
        <span>Title</span>
        <input
          className="su-input"
          type="text"
          value={title}
          maxLength={140}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="su-field">
        <span>Description</span>
        <textarea
          className="su-input su-textarea"
          value={description}
          maxLength={300}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className="su-mod-row">
        <label className="su-field">
          <span>Content type</span>
          <select className="su-input" value={contentType} onChange={(e) => setContentType(e.target.value)}>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="su-field">
          <span>Frame policy</span>
          <select className="su-input" value={framePolicy} onChange={(e) => setFramePolicy(e.target.value)}>
            {FRAME_POLICIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="su-field">
          <span>Quality ({Number(quality).toFixed(2)})</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
          />
        </label>
      </div>

      <div className="su-mod-interests">
        <span className="su-mod-label">Interests (at least one required to approve)</span>
        {groupedCatalog().map((group) => (
          <div key={group.id} className="su-interest-group">
            <h3>{group.name}</h3>
            <div className="su-chip-grid">
              {group.interests.map((interest) => (
                <button
                  key={interest.slug}
                  type="button"
                  className="su-chip"
                  aria-pressed={interests.has(interest.slug)}
                  onClick={() => toggleInterest(interest.slug)}
                >
                  {interest.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <label className="su-field">
        <span>Rejection reason (optional)</span>
        <input
          className="su-input"
          type="text"
          value={reason}
          maxLength={300}
          placeholder="Shown in the rejected list"
          onChange={(e) => setReason(e.target.value)}
        />
      </label>

      {error && <div className="su-form-error">{error}</div>}

      <div className="su-mod-actions">
        <button type="button" className="su-primary" disabled={busy} onClick={approve}>
          {busy ? 'Working…' : 'Approve'}
        </button>
        <button type="button" className="su-mod-reject" disabled={busy} onClick={reject}>
          Reject
        </button>
      </div>
    </div>
  )
}

function ModeratorsPanel() {
  const [moderators, setModerators] = useState([])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch('/.netlify/functions/stumble-moderators', { credentials: 'same-origin' })
      if (cancelled || !res.ok) return
      const data = await res.json()
      if (cancelled) return
      setModerators(Array.isArray(data.moderators) ? data.moderators : [])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const add = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/.netlify/functions/stumble-moderators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not add moderator.')
        return
      }
      setModerators(Array.isArray(data.moderators) ? data.moderators : [])
      setEmail('')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (target) => {
    const res = await fetch('/.netlify/functions/stumble-moderators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'remove', email: target }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) setModerators(Array.isArray(data.moderators) ? data.moderators : [])
  }

  return (
    <div className="su-mod-panel">
      <p className="su-mod-hint">
        Add Google account emails to grant moderation access. Owners configured via
        environment variables are always moderators and are not listed here.
      </p>
      <form className="su-mod-add" onSubmit={add}>
        <input
          className="su-input"
          type="email"
          value={email}
          placeholder="moderator@gmail.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="su-primary" disabled={busy}>
          {busy ? 'Adding…' : 'Add moderator'}
        </button>
      </form>
      {error && <div className="su-form-error">{error}</div>}
      {moderators.length === 0 ? (
        <p className="su-mod-empty">No moderators added yet.</p>
      ) : (
        <ul className="su-mod-list">
          {moderators.map((m) => (
            <li key={m.email} className="su-mod-list-item">
              <span>
                <strong>{m.email}</strong>
                {m.addedBy ? <span className="su-mod-meta"> · added by {m.addedBy}</span> : null}
              </span>
              <button type="button" className="su-mod-remove" onClick={() => remove(m.email)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ModerationQueuePage() {
  const { loading, canModerate, isOwner } = useAuth()
  const [tab, setTab] = useState('pending')
  const [pages, setPages] = useState([])
  const [status, setStatus] = useState('loading')
  // Approved tab is chunked by approver: `groups` holds the section metadata,
  // `groupData` caches each expanded section's pages, `expanded` tracks which
  // sections are open. Sections load lazily on first expand.
  const [groups, setGroups] = useState([])
  const [groupData, setGroupData] = useState({})
  const [expanded, setExpanded] = useState(() => new Set())

  // Switching tabs is a user event (not an effect), so setting the loading
  // state here keeps the effect free of synchronous setState.
  const selectTab = (next) => {
    setTab(next)
    if (next !== 'moderators') setStatus('loading')
    if (next === 'approved') {
      setGroups([])
      setGroupData({})
      setExpanded(new Set())
    }
  }

  useEffect(() => {
    if (!canModerate || tab === 'moderators') return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/.netlify/functions/stumble-moderation?status=${tab}`, {
          credentials: 'same-origin',
        })
        if (cancelled) return
        if (!res.ok) {
          setPages([])
          setGroups([])
          setStatus('error')
          return
        }
        const data = await res.json()
        if (cancelled) return
        if (tab === 'approved') {
          setGroups(Array.isArray(data.groups) ? data.groups : [])
        } else {
          setPages(Array.isArray(data.pages) ? data.pages : [])
        }
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canModerate, tab])

  // Expand/collapse an approver section, fetching its pages on first open.
  const toggleGroup = async (key) => {
    const isOpen = expanded.has(key)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (isOpen) next.delete(key)
      else next.add(key)
      return next
    })
    if (isOpen || groupData[key]) return
    setGroupData((prev) => ({ ...prev, [key]: { status: 'loading', pages: [] } }))
    try {
      const res = await fetch(
        `/.netlify/functions/stumble-moderation?status=approved&approvedBy=${encodeURIComponent(key)}`,
        { credentials: 'same-origin' },
      )
      const data = await res.json().catch(() => ({}))
      setGroupData((prev) => ({
        ...prev,
        [key]: res.ok
          ? { status: 'ready', pages: Array.isArray(data.pages) ? data.pages : [] }
          : { status: 'error', pages: [] },
      }))
    } catch {
      setGroupData((prev) => ({ ...prev, [key]: { status: 'error', pages: [] } }))
    }
  }

  const approve = async (id, payload) => {
    const res = await fetch('/.netlify/functions/stumble-moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id, action: 'approve', ...payload }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not approve.')
    setPages((prev) => prev.filter((p) => p.id !== id))
  }

  const reject = async (id, reason) => {
    const res = await fetch('/.netlify/functions/stumble-moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id, action: 'reject', reason }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Could not reject.')
    setPages((prev) => prev.filter((p) => p.id !== id))
  }

  // Permanently delete an approved page — used to undo an accidental approval.
  // Drops it from its section's cached pages and decrements the section count,
  // removing the section entirely when it empties.
  const remove = async (id, groupKey) => {
    if (!window.confirm('Delete this page permanently? This cannot be undone.')) return
    const res = await fetch('/.netlify/functions/stumble-moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id, action: 'delete' }),
    })
    if (!res.ok) return
    setGroupData((prev) => {
      const group = prev[groupKey]
      if (!group) return prev
      return { ...prev, [groupKey]: { ...group, pages: group.pages.filter((p) => p.id !== id) } }
    })
    setGroups((prev) =>
      prev
        .map((g) => (g.key === groupKey ? { ...g, count: g.count - 1 } : g))
        .filter((g) => g.count > 0),
    )
  }

  if (loading) return null

  if (!canModerate) {
    return (
      <div className="su-root su-mod-root">
        <div className="su-mod-shell">
          <h1>Moderation</h1>
          <p>You don’t have access to the moderation queue.</p>
          <Link className="su-primary" to="/stumble">Back to Stumble</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="su-root su-mod-root">
      <div className="su-mod-shell">
        <header className="su-mod-header">
          <h1>Moderation queue</h1>
          <Link className="su-mod-back" to="/stumble">← Back to Stumble</Link>
        </header>

        <nav className="su-mod-tabs" aria-label="Moderation views">
          <button
            type="button"
            className={`su-mod-tab${tab === 'pending' ? ' is-active' : ''}`}
            onClick={() => selectTab('pending')}
          >
            Pending
          </button>
          <button
            type="button"
            className={`su-mod-tab${tab === 'approved' ? ' is-active' : ''}`}
            onClick={() => selectTab('approved')}
          >
            Approved
          </button>
          <button
            type="button"
            className={`su-mod-tab${tab === 'rejected' ? ' is-active' : ''}`}
            onClick={() => selectTab('rejected')}
          >
            Rejected
          </button>
          {isOwner && (
            <button
              type="button"
              className={`su-mod-tab${tab === 'moderators' ? ' is-active' : ''}`}
              onClick={() => selectTab('moderators')}
            >
              Moderators
            </button>
          )}
        </nav>

        {tab === 'moderators' && isOwner && <ModeratorsPanel />}

        {tab !== 'moderators' && (
          <>
            {status === 'loading' && <p className="su-mod-empty">Loading…</p>}
            {status === 'error' && <p className="su-form-error">Could not load submissions.</p>}
            {status === 'ready' &&
              (tab === 'approved' ? groups.length === 0 : pages.length === 0) && (
                <p className="su-mod-empty">
                  {tab === 'pending'
                    ? 'Nothing waiting for review.'
                    : tab === 'approved'
                      ? 'No approved submissions.'
                      : 'No rejected submissions.'}
                </p>
              )}

            {tab === 'pending' &&
              status === 'ready' &&
              pages.map((page) => (
                <PendingCard key={page.id} page={page} onApprove={approve} onReject={reject} />
              ))}

            {tab === 'approved' &&
              status === 'ready' &&
              groups.map((group) => {
                const open = expanded.has(group.key)
                const data = groupData[group.key]
                return (
                  <div key={group.key} className="su-mod-group">
                    <button
                      type="button"
                      className="su-mod-group-head"
                      aria-expanded={open}
                      onClick={() => toggleGroup(group.key)}
                    >
                      <span className="su-mod-group-toggle" aria-hidden="true">
                        {open ? '▾' : '▸'}
                      </span>
                      <span className="su-mod-group-label">{group.label}</span>
                      <span className="su-mod-group-count">{group.count}</span>
                    </button>

                    {open && (
                      <div className="su-mod-group-body">
                        {(!data || data.status === 'loading') && (
                          <p className="su-mod-empty">Loading…</p>
                        )}
                        {data?.status === 'error' && (
                          <p className="su-form-error">Could not load pages.</p>
                        )}
                        {data?.status === 'ready' &&
                          data.pages.map((page) => (
                            <div key={page.id} className="su-mod-card su-mod-card--approved">
                              <div className="su-mod-card-head">
                                <a
                                  href={page.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="su-mod-url"
                                >
                                  {page.title || page.url}
                                </a>
                                <span className="su-mod-meta">{page.domain}</span>
                              </div>
                              <span className="su-mod-meta">
                                Approved {formatDate(page.approvedAt)}
                                {page.approvedBy ? ` by ${page.approvedBy}` : ''}
                              </span>
                              <div className="su-mod-actions">
                                <button
                                  type="button"
                                  className="su-mod-reject"
                                  onClick={() => remove(page.id, group.key)}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )
              })}

            {tab === 'rejected' &&
              status === 'ready' &&
              pages.map((page) => (
                <div key={page.id} className="su-mod-card su-mod-card--rejected">
                  <div className="su-mod-card-head">
                    <a href={page.url} target="_blank" rel="noopener noreferrer" className="su-mod-url">
                      {page.title || page.url}
                    </a>
                    <span className="su-mod-meta">{page.domain}</span>
                  </div>
                  {page.rejectionReason && <p className="su-mod-note">Reason: {page.rejectionReason}</p>}
                  <span className="su-mod-meta">
                    Rejected {formatDate(page.rejectedAt)}
                    {page.rejectedBy ? ` by ${page.rejectedBy}` : ''}
                  </span>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  )
}
