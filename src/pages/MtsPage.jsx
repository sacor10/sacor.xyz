import { useEffect, useState } from 'react'
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
            <td align="center" bgColor="#FF00FF" className="section-bar-sm">
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

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgColor="#000000">
        <tbody>
          <tr>
            <td align="center" bgColor="#00FFFF" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">
                ~ ABOUT MTS ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgColor="#000000">
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

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgColor="#4B0082">
        <tbody>
          <tr>
            <td align="center" bgColor="#FFFF00" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">
                ~ STATUS ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgColor="#000000" align="center">
              <font face="Comic Sans MS" size="2" color="#00FFFF">
                {onAir ? (
                  <blink>
                    <font color="#FF0000">&#9679; ON AIR</font>
                  </blink>
                ) : (
                  <font color="#888888">&#9711; off air</font>
                )}
                <br />
                <br />
                <font color="#FFFF00">click unmute for sound!!!</font>
                <br />
                <font face="Comic Sans MS" size="1" color="#FF00FF">
                  (browsers block autoplay sound)
                </font>
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

function Player({ status, videoId, subhead }) {
  return (
    <>
      <center>
        <font face="Impact" size="6" color="#FF00FF" className="hero-glow">
          <blink>~*~ LIVE FROM @MTSLIVE ~*~</blink>
        </font>
      </center>

      <br />

      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td align="center" bgColor="#FF00FF" className="section-bar">
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
              <td align="center" bgColor="#00FFFF" className="section-bar">
                <font face="Impact" size="4" color="#000000">
                  ~ THE LIVE FEED ~
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgColor="#000000">
        <tbody>
          <tr>
            <td bgColor="#000000" align="center">
              {status === 'loading' && (
                <font face="Comic Sans MS" size="3" color="#00FFFF">
                  <blink>Tuning in...</blink>
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
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&playsinline=1`}
                    title="MTS Live"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    frameBorder="0"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      border: 0,
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

  useEffect(() => {
    let cancelled = false
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
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Layout
      mainContent={<Player status={status} videoId={videoId} subhead={subhead} />}
      rightSidebar={<Sidebar episode={episode} onAir={status === 'ready'} />}
    />
  )
}
