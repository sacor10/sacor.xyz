import { useEffect, useRef } from 'react'
import { useAuth } from './useAuth'

export default function GoogleSignInButton() {
  const { user, loading, signOut, gisReady, clientId } = useAuth()
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!gisReady) return
    if (user) return
    if (!buttonRef.current) return
    if (!window.google?.accounts?.id) return
    try {
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'medium',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      })
    } catch {
      /* ignore */
    }
  }, [gisReady, user])

  if (loading) {
    return (
      <span className="account-pill">
        <font face="Comic Sans MS" size="2" color="#FFFF00">
          checking session...
        </font>
      </span>
    )
  }

  if (!clientId) {
    return (
      <span className="account-pill">
        <font face="Comic Sans MS" size="2" color="#FF00FF">
          missing VITE_GOOGLE_CLIENT_ID
        </font>
      </span>
    )
  }

  if (user) {
    return (
      <span className="account-pill">
        <font face="Comic Sans MS" size="2" color="#00FF00">
          {user.canAccessTravelPlans || user.isOwner ? '* ' : ''}signed in as <b>{user.email}</b>
        </font>
        <button type="button" className="signout-btn" onClick={signOut}>
          Sign Out
        </button>
      </span>
    )
  }

  return <div ref={buttonRef} className="gis-btn" />
}
