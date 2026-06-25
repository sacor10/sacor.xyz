import { useEffect, useState } from 'react'

// Claim a public @username — required before following or being followed.
// Mirrors SignInModal/SubmitSiteModal so the GeoCities theme never bleeds in.
// Doubles as the rename modal via the title/submitLabel/initialValue props.
export default function ClaimUsernameModal({
  onClose,
  onClaim,
  reason,
  title = 'Choose your username',
  submitLabel = 'Claim',
  initialValue = '',
}) {
  const [username, setUsername] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const value = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(value)) {
      setError('3–20 characters: lowercase letters, numbers, or underscores.')
      return
    }
    setBusy(true)
    try {
      await onClaim(value)
    } catch (err) {
      setError(err.message || 'Could not claim that username.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="su-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="su-modal" role="dialog" aria-modal="true" aria-label="Choose a username">
        <button type="button" className="su-modal-close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <h2>{title}</h2>
        <p>{reason || 'Pick a public @handle so others can follow you and browse your likes.'}</p>
        <form onSubmit={handleSubmit}>
          <div className="su-claim-input">
            <span aria-hidden="true">@</span>
            <input
              className="su-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yourname"
              maxLength={20}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          {error && <div className="su-form-error">{error}</div>}
          <div className="su-dialog-footer">
            <span className="su-dialog-hint">Letters, numbers, underscores. Can’t be changed later.</span>
            <button type="submit" className="su-primary" disabled={busy}>
              {busy ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
