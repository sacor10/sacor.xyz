import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './App.css'
import GoogleSignInButton from './auth/GoogleSignInButton'
import { useAuth } from './auth/useAuth'

const baseNavLinks = [
  { label: 'HOME',       to: '/' },
  { label: 'ABOUT ME',   to: '/#about-me' },
  { label: 'BLOG POSTS', to: '/blog' },
  { label: 'DOWNLOADS',  to: '/ytmp4' },
  { label: 'MTS LIVE',   to: '/mts' },
  { label: 'LIVE STOCKS', to: '/stocks' },
  { label: 'GUESTBOOK',  to: '/guestbook' },
  { label: 'CONTACT',    to: '/contact' },
]

const ownerNavLink = { label: 'TRAVEL PLANS', to: '/travel-plans' }

function useMediaQuery(query) {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = () => setMatches(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

const PANE_LABELS = ['Show navigation', 'Show main content', 'Show sidebar']

export default function Layout({ mainContent, rightSidebar }) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [pane, setPane] = useState(1)
  const { canAccessTravelPlans } = useAuth()
  const navLinks = canAccessTravelPlans
    ? [...baseNavLinks.slice(0, 6), ownerNavLink, ...baseNavLinks.slice(6)]
    : baseNavLinks
  const touch = useRef({ x: 0, y: 0, t: 0, axis: null, startPane: 1, ignore: false })

  const onTouchStart = (e) => {
    const t0 = e.touches[0]
    const ignore = !!(
      e.target.closest &&
      (e.target.closest('[data-no-pane-swipe]') || e.target.closest('.leaflet-container'))
    )
    touch.current = {
      x: t0.clientX,
      y: t0.clientY,
      t: Date.now(),
      axis: null,
      startPane: pane,
      ignore,
    }
  }

  const onTouchMove = (e) => {
    if (touch.current.ignore) return
    const t0 = e.touches[0]
    const dx = t0.clientX - touch.current.x
    const dy = t0.clientY - touch.current.y
    if (touch.current.axis === null && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
      touch.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (touch.current.axis === 'x' && e.cancelable) {
      e.preventDefault()
    }
  }

  const onTouchEnd = (e) => {
    if (touch.current.ignore) {
      touch.current.axis = null
      return
    }
    const t1 = e.changedTouches[0]
    const dx = t1.clientX - touch.current.x
    const threshold = Math.min(60, window.innerWidth * 0.25)
    if (touch.current.axis === 'x' && Math.abs(dx) > threshold) {
      setPane((p) => {
        if (dx < 0) return Math.min(p + 1, 2)
        return Math.max(p - 1, 0)
      })
    }
    touch.current.axis = null
  }

  return (
    <div className="geocities">
      {/* ============ TOP HEADER BANNER ============ */}
      <center>
        <table
          width="95%"
          cellPadding="10"
          cellSpacing="0"
          border="4"
          bgColor="#000000"
          className="header-table"
        >
          <tbody>
            <tr>
              <td align="center" bgColor="#4B0082">
                <img
                  src="/generated-assets/globe-v2.png"
                  alt="spinning globe"
                  width="64"
                  height="64"
                  border="0"
                  align="left"
                />
                <img
                  src="/generated-assets/globe-v2.png"
                  alt="spinning globe"
                  width="64"
                  height="64"
                  border="0"
                  align="right"
                />
                <h1 className="glow">
                  <blink>SACOR&rsquo;S SPACE</blink>
                </h1>
                <font face="Comic Sans MS" size="4" color="#00FFFF">
                  ~*~ DO WHAT YOU CAN, WITH WHAT YOU HAVE, WHERE YOU ARE ~*~ WE HAVE FALLEN HEIRS TO THE MOST GLORIOUS HERITAGE A PEOPLE EVER RECEIVED ~*~
                </font>
                <br />
                <br />
                <marquee behavior="scroll" direction="left" scrollAmount="6" bgColor="#FFFF00" width="90%">
                  <font face="Impact" size="4" color="#FF00FF">
                    &#9733; Since 1776 &#9733;
                    &nbsp;&nbsp;&nbsp; SIGN MY GUESTBOOK!?! &nbsp;&nbsp;&nbsp;
                    &#9829; THANKS FOR VISITING! &#9829;
                  </font>
                </marquee>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      {/* ============ MAIN 3-COLUMN LAYOUT ============ */}
      <div
        className={isMobile ? 'pane-viewport' : ''}
        style={isMobile ? { '--pane': pane } : undefined}
        onTouchStart={isMobile ? onTouchStart : undefined}
        onTouchMove={isMobile ? onTouchMove : undefined}
        onTouchEnd={isMobile ? onTouchEnd : undefined}
      >
      <center>
        <table width="95%" cellPadding="8" cellSpacing="6" border="0">
          <tbody>
            <tr valign="top">
              {/* ========== LEFT NAV SIDEBAR ========== */}
              <td width="18%" bgColor="#000080" className="left-sidebar">
                <center>
                  <font face="Impact" size="5" color="#FFFF00">
                    <blink>~ NAVIGATE ~</blink>
                  </font>
                  <br />
                  <br />
                  <img
                    src="/generated-assets/construction-v2.png"
                    alt="construction worker"
                    width="90"
                    height="90"
                    border="3"
                    className="ridge-pink"
                  />
                  <br />
                  <br />
                  <div className="header-account">
                    <GoogleSignInButton />
                  </div>
                  <br />
                </center>

                <table width="100%" cellPadding="0" cellSpacing="6" border="0">
                  <tbody>
                    {navLinks.map((nav) => (
                      <tr key={nav.label}>
                        <td className="navbtn">
                          <Link to={nav.to}>&#9733; {nav.label} &#9733;</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>

              {/* ========== MAIN + RIGHT CONTENT ========== */}
              <td width="56%" bgColor="#2E0854" className="main-content">
                {mainContent}
              </td>

              <td width="26%">
                {rightSidebar}
              </td>
            </tr>
          </tbody>
        </table>
      </center>
      </div>

      {isMobile && (
        <center className="pane-dots">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              className={'pane-dot' + (i === pane ? ' active' : '')}
              onClick={() => setPane(i)}
              aria-label={PANE_LABELS[i]}
            >
              {i === pane ? '●' : '○'}
            </button>
          ))}
        </center>
      )}

      <br />

      {/* ============ FOOTER ============ */}
      <center>
        <table width="95%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td className="footer">
                <marquee behavior="alternate" scrollAmount="4">
                  <font face="Courier New" size="2" color="#FF00FF">
                    &#9733; &#9733; &#9733; THANKS FOR VISITING! TELL YOUR FRIENDS! &#9733; &#9733; &#9733;
                  </font>
                </marquee>
                <br />
                <font face="Courier New" size="2" color="#00FF00">
                  &copy; 1989&ndash;2026 Sacor &nbsp;&bull;&nbsp; Made with{' '}
                  <b className="cyan">Microsoft FrontPage</b> &nbsp;&bull;&nbsp; Best viewed in{' '}
                  <b className="yellow">Netscape Navigator 4.7</b> at 800&times;600 &nbsp;&bull;&nbsp; Email me at{' '}
                  <a href="mailto:vestibule@sacor.xyz" className="yellow-link">
                    vestibule@sacor.xyz
                  </a>
                </font>
                <br />
                <br />
                <font face="Comic Sans MS" size="1" color="#FFFFFF">
                  This page is a member of the <b className="hotpink">Green Hill Zone Webring</b> &#9733;{' '}
                  <Link to="/webring" className="cyan-link">[Prev]</Link>{' '}
                  <Link to="/webring" className="cyan-link">[Next]</Link>{' '}
                  <Link to="/webring" className="cyan-link">[Random]</Link>{' '}
                  <Link to="/webring" className="cyan-link">[List Sites]</Link>
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />
    </div>
  )
}
