import { useEffect, useRef, useState } from 'react'
import Layout from '../Layout'

const CONFIG_URL = 'https://mts-api.dev-bae.workers.dev/config'

function extractYouTubeId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    const v = u.searchParams.get('v')
    if (v) return v
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    const m = u.pathname.match(/\/embed\/([^/?]+)/)
    if (m) return m[1]
  } catch {
    return null
  }
  return null
}

function Sidebar({ episode, onAir }) {
  return (
    <>
      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
              <font face="Impact" size="4" color="#FFFF00">
                ~ NAVIGATION ~
              </font>
            </td>
          </tr>
          <tr>
            <td align="center">
              <font face="Comic Sans MS" size="2" color="#FFFFFF">
                You are tuned in to the situation!!!
                <br />
                <br />
              </font>
              <a href="/" className="navbtn-link">&#9733; BACK TO HOME &#9733;</a>
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
                ~ ABOUT MTS ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#00FF00">
                <b className="yellow">MTS</b> is an X-native daily tech news show.
                <br />
                <br />
                Live <b className="hotpink">09:00 PT weekdays</b>, hosted by{' '}
                <b className="cyan">@MTSlive</b>.
                <br />
                <br />
                {episode != null && (
                  <>
                    <font color="#FFFF00">Currently: Episode {episode}</font>
                    <br />
                    <br />
                  </>
                )}
                <a
                  href="https://www.mts.now/"
                  target="_blank"
                  rel="noreferrer"
                  className="navbtn-link"
                >
                  &#9733; mts.now &#9733;
                </a>
                <br />
                <br />
                <a
                  href="https://x.com/MTSlive"
                  target="_blank"
                  rel="noreferrer"
                  className="navbtn-link"
                >
                  &#9733; @MTSlive on X &#9733;
                </a>
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#4B0082">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">
                ~ STATUS ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000" align="center">
              <font face="Comic Sans MS" size="2" color="#00FFFF">
                {onAir ? (
                  <span className="blink">
                    <font color="#FF0000">&#9679; ON AIR</font>
                  </span>
                ) : (
                  <font color="#888888">&#9711; off air</font>
                )}
                <br />
                <br />
                <font color="#FFFF00">sound should auto-start!!!</font>
                <br />
                <font face="Comic Sans MS" size="1" color="#FF00FF">
                  (if muted, click the player to unmute)
                </font>
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

function loadYouTubeApi() {
  if (document.getElementById('yt-api-script')) return
  const s = document.createElement('script')
  s.id = 'yt-api-script'
  s.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(s)
}

function Player({ status, videoId, subhead, onRetry }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (status !== 'ready' || !videoId) return

    let player = null
    let destroyed = false

    function createPlayer() {
      if (destroyed || !containerRef.current) return
      containerRef.current.innerHTML = ''
      const target = document.createElement('div')
      containerRef.current.appendChild(target)

      player = new window.YT.Player(target, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          mute: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady(e) {
            if (!destroyed) {
              e.target.unMute()
              e.target.setVolume(100)
            }
          },
        },
      })
    }

    if (window.YT?.Player) {
      createPlayer()
    } else {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        prev?.()
        createPlayer()
      }
      loadYouTubeApi()
    }

    return () => {
      destroyed = true
      player?.destroy()
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [status, videoId])

  return (
    <>
      <center>
        <font face="Impact" size="6" color="#FF00FF" className="hero-glow">
          <span className="blink">~*~ LIVE FROM @MTSLIVE ~*~</span>
        </font>
      </center>

      <br />

      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td align="center" bgcolor="#FF00FF" className="section-bar">
                <font face="Impact" size="5" color="#FFFF00">
                  ~*~ {subhead || 'MAKE SENSE OF THE WORLD RIGHT NOW'} ~*~
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
        <tbody>
          <tr>
            <td>
              <font face="Comic Sans MS" size="3" color="#FFFFFF">
                <b className="lime">MTS</b> is a daily tech news livestream from{' '}
                <b className="cyan">@MTSlive</b> &mdash; live{' '}
                <b className="hotpink">09:00 PT weekdays</b>. I&rsquo;m piping their{' '}
                <b className="yellow">YouTube simulcast</b> into Sacor&rsquo;s Space so
                you can watch and listen RIGHT HERE!!! No X or YouTube account needed!!!
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td align="center" bgcolor="#00FFFF" className="section-bar">
                <font face="Impact" size="4" color="#000000">
                  ~ THE LIVE FEED ~
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
        <tbody>
          <tr>
            <td bgcolor="#000000" align="center">
              {status === 'loading' && (
                <font face="Comic Sans MS" size="3" color="#00FFFF">
                  <span className="blink">Tuning in...</span>
                </font>
              )}
              {status === 'ready' && videoId && (
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    paddingTop: '56.25%',
                  }}
                >
                  <div
                    ref={containerRef}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                    }}
                  />
                </div>
              )}
              {status === 'error' && (
                <font face="Comic Sans MS" size="3" color="#FFFF00">
                  Couldn&rsquo;t reach mts.now &mdash; try{' '}
                  <a
                    href="https://x.com/MTSlive"
                    target="_blank"
                    rel="noreferrer"
                    className="hotpink"
                  >
                    @MTSlive on X
                  </a>{' '}
                  or{' '}
                  <a
                    href="https://www.mts.now/"
                    target="_blank"
                    rel="noreferrer"
                    className="hotpink"
                  >
                    mts.now
                  </a>{' '}
                  directly!!!
                  <br />
                  <br />
                  <button
                    onClick={onRetry}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit',
                      padding: 0,
                    }}
                  >
                    <span className="navbtn-link">&#9733; TRY AGAIN &#9733;</span>
                  </button>
                </font>
              )}
              {status === 'offline' && (
                <font face="Comic Sans MS" size="3" color="#FFFF00">
                  MTS isn&rsquo;t live right now!!! Tune in <b className="hotpink">09:00 PT weekdays</b>.
                  <br />
                  <br />
                  <a
                    href="https://x.com/MTSlive"
                    target="_blank"
                    rel="noreferrer"
                    className="navbtn-link"
                  >
                    &#9733; CHECK @MTSlive ON X &#9733;
                  </a>
                </font>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <center>
        <font face="Comic Sans MS" size="2" color="#888888">
          Stream config courtesy of <a href="https://www.mts.now/">mts.now</a>
          &nbsp;&#9733;&nbsp; <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
        </font>
      </center>

      <br />
    </>
  )
}

export default function MtsPage() {
  const [status, setStatus] = useState('loading')
  const [videoId, setVideoId] = useState(null)
  const [episode, setEpisode] = useState(null)
  const [subhead, setSubhead] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    function tryFetch(n) {
      fetch(CONFIG_URL)
        .then((r) => {
          if (!r.ok) throw new Error(`config ${r.status}`)
          return r.json()
        })
        .then((cfg) => {
          if (cancelled) return
          const id = extractYouTubeId(cfg.youtubeLiveUrl)
          setEpisode(cfg.episode ?? null)
          setSubhead(cfg.subheadOverride ?? null)
          if (id) {
            setVideoId(id)
            setStatus('ready')
          } else {
            setStatus('offline')
          }
        })
        .catch(() => {
          if (cancelled) return
          if (n < 2) {
            setTimeout(() => tryFetch(n + 1), 1000 * Math.pow(2, n))
          } else {
            setStatus('error')
          }
        })
    }

    tryFetch(0)
    return () => {
      cancelled = true
    }
  }, [attempt])

  const handleRetry = () => setAttempt((a) => a + 1)

  return (
    <Layout
      mainContent={<Player status={status} videoId={videoId} subhead={subhead} onRetry={handleRetry} />}
      rightSidebar={<Sidebar episode={episode} onAir={status === 'ready'} />}
    />
  )
}
