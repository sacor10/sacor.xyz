import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import GoogleSignInButton from './auth/GoogleSignInButton'
import { useAuth } from './auth/useAuth'
import { ringNeighbors, randomMember } from './data/webring'

const NAV_GROUPS = [
  {
    title: 'MAIN',
    links: [
      { label: 'HOME',     to: '/' },
      { label: 'ABOUT ME', to: '/#about-me' },
    ],
  },
  {
    title: 'DOWNLOADS',
    links: [
      { label: 'DOWNLOADS', to: '/downloads' },
    ],
  },
  {
    title: 'READS & MEDIA',
    links: [
      { label: 'BLOG POSTS', to: '/blog' },
      { label: 'QUOTES',     to: '/quotes' },
      { label: 'MTS LIVE',   to: '/mts' },
    ],
  },
  {
    title: 'TOOLS',
    links: [
      { label: 'LIVE STOCKS',  to: '/stocks' },
      { label: 'STUMBLE!',     to: '/stumble', icon: '🎲' },
      { label: 'TRAVEL PLANS', to: '/travel-plans', owner: true },
    ],
  },
  {
    title: 'SAY HI',
    links: [
      { label: 'GUESTBOOK', to: '/guestbook' },
      { label: 'CONTACT',   to: '/contact' },
    ],
  },
  {
    title: 'FRIENDS',
    links: [
      { label: 'EASTON', to: '/easton', icon: '☺' },
    ],
  },
  {
    title: 'WEBRING',
    links: [
      { label: "George's Vista", to: 'https://georgesvista.netlify.app/', external: true, icon: '🌄' },
      { label: 'LIST SITES',     to: '/webring', icon: '💍' },
    ],
  },
]

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

const LOCKED_ZONE_SELECTOR = '.itinerary-map-zone, .leaflet-container, .stock-chart-zone'

export default function Layout({ mainContent, rightSidebar, pageWideContent = null }) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const location = useLocation()
  const navigate = useNavigate()
  const [pane, setPane] = useState(1)
  const { canAccessTravelPlans } = useAuth()

  // Footer webring nav. The footer always renders on sacor pages, so the
  // current ring position is '/'.
  const { prev: ringPrev, next: ringNext } = ringNeighbors('/')
  const goRandom = (e) => {
    e.preventDefault()
    const m = randomMember('/')
    if (m.external) {
      window.open(m.url, '_blank', 'noopener,noreferrer')
    } else {
      navigate(m.url)
    }
  }
  const visibleGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => !link.owner || canAccessTravelPlans),
    }))
    .filter((group) => group.links.length > 0)
  const viewportRef = useRef(null)
  const paneRef = useRef(pane)
  const pathRef = useRef(location.pathname)
  const swipeRef = useRef({ active: false, pointerId: null, x: 0, y: 0, axis: null, startPane: 1 })

  useEffect(() => {
    paneRef.current = pane
  }, [pane])

  useEffect(() => {
    pathRef.current = location.pathname
  }, [location.pathname])

  useEffect(() => {
    if (!isMobile) return
    const vp = viewportRef.current
    if (!vp) return

    const pointerInLockedZone = (e) => {
      if (e.target instanceof Element && e.target.closest(LOCKED_ZONE_SELECTOR)) {
        return true
      }
      const zones = document.querySelectorAll(LOCKED_ZONE_SELECTOR)
      for (const zone of zones) {
        const r = zone.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          return true
        }
      }
      return false
    }

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerEnd)
      window.removeEventListener('pointercancel', onPointerCancel)
    }

    const resetSwipe = () => {
      swipeRef.current = { active: false, pointerId: null, x: 0, y: 0, axis: null, startPane: paneRef.current }
      cleanup()
    }

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (pointerInLockedZone(e)) return
      const onTravelPlan = pathRef.current.startsWith('/travel-plans/')
      if (onTravelPlan && paneRef.current !== 0) return

      swipeRef.current = {
        active: true,
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        axis: null,
        startPane: paneRef.current,
      }
      window.addEventListener('pointermove', onPointerMove, { passive: false })
      window.addEventListener('pointerup', onPointerEnd)
      window.addEventListener('pointercancel', onPointerCancel)
    }

    function onPointerMove(e) {
      const swipe = swipeRef.current
      if (!swipe.active || e.pointerId !== swipe.pointerId) return

      if (pointerInLockedZone(e)) {
        resetSwipe()
        return
      }

      const dx = e.clientX - swipe.x
      const dy = e.clientY - swipe.y
      if (swipe.axis === null && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
        swipe.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      }
      if (swipe.axis === 'x' && e.cancelable) {
        e.preventDefault()
      }
    }

    function onPointerEnd(e) {
      const swipe = swipeRef.current
      if (!swipe.active || e.pointerId !== swipe.pointerId) return

      if (pointerInLockedZone(e)) {
        resetSwipe()
        return
      }

      const dx = e.clientX - swipe.x
      const threshold = Math.min(60, window.innerWidth * 0.25)
      if (swipe.axis === 'x' && Math.abs(dx) > threshold) {
        setPane(dx < 0 ? Math.min(swipe.startPane + 1, 2) : Math.max(swipe.startPane - 1, 0))
      }

      resetSwipe()
    }

    function onPointerCancel(e) {
      const swipe = swipeRef.current
      if (e.pointerId !== swipe.pointerId) return
      resetSwipe()
    }

    vp.addEventListener('pointerdown', onPointerDown)
    return () => {
      vp.removeEventListener('pointerdown', onPointerDown)
      cleanup()
    }
  }, [isMobile])

  const goToPane = (i) => {
    setPane(i)
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
          bgcolor="#000000"
          className="header-table"
        >
          <tbody>
            <tr>
              <td align="center" bgcolor="#4B0082">
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
                  <span className="blink">SACOR&rsquo;S SPACE</span>
                </h1>
                <font face="Comic Sans MS" size="4" color="#00FFFF">
                  ~*~ DO WHAT YOU CAN, WITH WHAT YOU HAVE, WHERE YOU ARE ~*~ WE HAVE FALLEN HEIRS TO THE MOST GLORIOUS HERITAGE A PEOPLE EVER RECEIVED ~*~
                </font>
                <br />
                <br />
                <marquee behavior="scroll" direction="left" scrollamount="6" bgcolor="#FFFF00" width="90%">
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

      {pageWideContent && (
        <>
          <center className="page-wide-mount">
            <table width="95%" cellPadding="0" cellSpacing="0" border="0">
              <tbody>
                <tr>
                  <td bgcolor="#2E0854" className="page-wide-content" valign="top">
                    {pageWideContent}
                  </td>
                </tr>
              </tbody>
            </table>
          </center>

          <br />
        </>
      )}

      {/* ============ MAIN 3-COLUMN LAYOUT ============ */}
      <div
        ref={viewportRef}
        className={isMobile ? 'pane-viewport' : ''}
        style={isMobile ? { '--pane': pane } : undefined}
      >
      <center>
        <table width="95%" cellPadding="8" cellSpacing="6" border="0">
          <tbody>
            <tr valign="top">
              {/* ========== LEFT NAV SIDEBAR ========== */}
              <td width="18%" className="left-sidebar" valign="top">
                <div className="sticky-mount">
                  <div className="sticky-pane">
                    <center>
                    <font face="Impact" size="5" color="#FFFF00">
                      <span className="blink">~ NAVIGATE ~</span>
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

                  {visibleGroups.map((group) => (
                    <div key={group.title} className="nav-group">
                      <center>
                        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
                          <tbody>
                            <tr>
                              <td align="center" bgcolor="#FF00FF" className="section-bar-sm nav-group-bar">
                                <font face="Impact" size="3" color="#FFFF00">~ {group.title} ~</font>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </center>
                      <table width="100%" cellPadding="0" cellSpacing="6" border="0">
                        <tbody>
                          {group.links.map((nav) => (
                            <tr key={nav.label}>
                              <td className="navbtn">
                                {nav.external ? (
                                  <a href={nav.to} target="_blank" rel="noopener noreferrer">{nav.icon || '★'} {nav.label} {nav.icon || '★'}</a>
                                ) : (
                                  <Link to={nav.to}>{nav.icon || '★'} {nav.label} {nav.icon || '★'}</Link>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  </div>
                </div>
              </td>

              {/* ========== MAIN + RIGHT CONTENT ========== */}
              <td width="56%" bgcolor="#2E0854" className="main-content" valign="top">
                {isMobile && (
                  <center className="mobile-menu-bar">
                    <button
                      type="button"
                      className="mobile-menu-btn"
                      onClick={() => goToPane(0)}
                      aria-label="Show navigation menu"
                    >
                      &#9776; MENU
                    </button>
                  </center>
                )}
                {mainContent}
              </td>

              <td width="26%" className="right-sidebar" valign="top">
                <div className="sticky-mount">
                  <div className="sticky-pane">{rightSidebar}</div>
                </div>
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
              onClick={() => goToPane(i)}
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
                <marquee behavior="alternate" scrollamount="4">
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
                  {ringPrev.external ? (
                    <a href={ringPrev.url} target="_blank" rel="noopener noreferrer" className="cyan-link">[Prev]</a>
                  ) : (
                    <Link to={ringPrev.url} className="cyan-link">[Prev]</Link>
                  )}{' '}
                  {ringNext.external ? (
                    <a href={ringNext.url} target="_blank" rel="noopener noreferrer" className="cyan-link">[Next]</a>
                  ) : (
                    <Link to={ringNext.url} className="cyan-link">[Next]</Link>
                  )}{' '}
                  <a href="/webring" onClick={goRandom} className="cyan-link">[Random]</a>{' '}
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
