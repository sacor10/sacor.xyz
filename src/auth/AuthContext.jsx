import { useEffect, useState, useCallback, useRef } from 'react'
import { AuthContext } from './authContext'

const GIS_SRC = 'https://accounts.google.com/gsi/client'

function loadGisScript() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (window.__gisLoadPromise) return window.__gisLoadPromise
  window.__gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google))
      existing.addEventListener('error', reject)
      return
    }
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve(window.google)
    s.onerror = reject
    document.head.appendChild(s)
  })
  return window.__gisLoadPromise
}

export function AuthProvider({ children }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gisReady, setGisReady] = useState(false)
  const initialized = useRef(false)

  const handleCredential = useCallback(async (response) => {
    const credential = response?.credential
    if (!credential) return
    try {
      const res = await fetch('/.netlify/functions/auth-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        setUser(null)
        return
      }
      const data = await res.json()
      const canAccessTravelPlans = !!(data.canAccessTravelPlans || data.isOwner)
      setUser({ email: data.email, canAccessTravelPlans, isOwner: canAccessTravelPlans })
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/.netlify/functions/auth-me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data) => {
        if (!cancelled) setUser(data?.user || null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!clientId) return
    if (initialized.current) return
    loadGisScript()
      .then((google) => {
        if (!google?.accounts?.id) return
        google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,
          ux_mode: 'popup',
        })
        initialized.current = true
        setGisReady(true)
      })
      .catch(() => setGisReady(false))
  }, [clientId, handleCredential])

  const signOut = useCallback(async () => {
    try {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.disableAutoSelect()
      }
    } catch {
      /* ignore */
    }
    await fetch('/.netlify/functions/auth-logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => {})
    setUser(null)
  }, [])

  const value = {
    user,
    loading,
    isSignedIn: !!user,
    isOwner: !!user?.isOwner,
    canAccessTravelPlans: !!(user?.canAccessTravelPlans || user?.isOwner),
    gisReady,
    clientId,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
