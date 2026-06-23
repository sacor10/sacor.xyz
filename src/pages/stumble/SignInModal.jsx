import { useEffect } from 'react'
import GoogleSignInButton from '../../auth/GoogleSignInButton'

// StumbleUpon-style sign-in modal. Reuses the existing GoogleSignInButton, but
// in a neutral container so the GeoCities `.geocities` styles never apply.
// Triggered by the Bar 1 pill and when a guest tries to rate.
export default function SignInModal({ onClose }) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="su-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="su-modal" role="dialog" aria-modal="true" aria-label="Sign in">
        <button
          type="button"
          className="su-modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
        <h2>Join StumbleUpon</h2>
        <p>Sign in to like, follow, and tune your stumbles.</p>
        <div className="su-modal-body">
          <GoogleSignInButton />
        </div>
      </div>
    </div>
  )
}
