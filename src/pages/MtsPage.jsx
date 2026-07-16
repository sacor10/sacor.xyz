import { useCallback, useState } from 'react'
import Layout from '../Layout'
import {
  LivestreamPlayer,
  LivestreamWideNotice,
  LivestreamOfflineNotice,
} from '../components/LivestreamPlayer'

const MTS_LIVE_URL = 'https://www.youtube.com/@mtsituation/live'
const MTS_CHANNEL_ID = 'UClWkDGXEzsh77GAhs90wpXw'
const MTS_STREAM_SRC = `https://www.youtube.com/embed/live_stream?channel=${MTS_CHANNEL_ID}&autoplay=1&mute=1&enablejsapi=1&modestbranding=1&rel=0&playsinline=1`

function Sidebar() {
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
                Live <b className="hotpink">09:00 PT weekdays</b> &mdash; tune in at{' '}
                <a
                  href="https://www.mts.now/"
                  target="_blank"
                  rel="noreferrer"
                  className="hotpink"
                >
                  mts.now
                </a>
                .
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

function Player({ isStreamExpanded, onToggleStream, onLivenessChange, isOffline }) {
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
                  ~*~ MAKE SENSE OF THE WORLD RIGHT NOW ~*~
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
                <b className="hotpink">09:00 PT weekdays</b>. Catch the{' '}
                <b className="yellow">YouTube simulcast</b> on mts.now or follow along
                on X!!!
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
            <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">
                ~ TUNE IN ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000" align="center">
              <font face="Comic Sans MS" size="3" color="#00FFFF">
                MTS goes live <b className="hotpink">09:00 PT weekdays</b>!!!
                <br />
                <br />
                Smash <b className="yellow">STRETCH PLAYER</b> to blow the{' '}
                <b className="yellow">current YouTube livestream</b>
                <br />
                across the page &mdash; streaming straight from{' '}
                <b className="cyan">@mtsituation</b>, no stale VODs!!!
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      {isOffline ? (
        <LivestreamOfflineNotice
          title="MTS Live"
          watchUrl={MTS_LIVE_URL}
          note="MTS goes live 09:00 PT weekdays — tune in on YouTube when the show's on!!!"
        />
      ) : isStreamExpanded ? (
        <LivestreamWideNotice title="MTS Live" onCollapse={onToggleStream} />
      ) : (
        <LivestreamPlayer
          src={MTS_STREAM_SRC}
          title="MTS Live"
          isExpanded={false}
          onToggleExpanded={onToggleStream}
          onLivenessChange={onLivenessChange}
          autoUnmute
        />
      )}

      <br />

      <center>
        <font face="Comic Sans MS" size="3" color="#00FFFF">
          Player acting up??? Pop the stream straight on YouTube:
          <br />
          <br />
          <a
            href={MTS_LIVE_URL}
            target="_blank"
            rel="noreferrer"
            className="navbtn-link"
          >
            &#9733; WATCH LIVE ON YOUTUBE &#9733;
          </a>
          <br />
          <br />
          Prefer the X-native simulcast???
          <br />
          <br />
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
      </center>

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
  const [isStreamExpanded, setIsStreamExpanded] = useState(false)
  const [liveness, setLiveness] = useState('checking')
  const toggleStream = () => setIsStreamExpanded((expanded) => !expanded)
  const isOffline = liveness === 'offline'

  // Stable handler so the player isn't re-created on every render. A stream that
  // drops offline can't be stretched, so collapse back to the column too.
  const handleLiveness = useCallback((state) => {
    setLiveness(state)
    if (state === 'offline') setIsStreamExpanded(false)
  }, [])

  return (
    <Layout
      mainContent={
        <Player
          isStreamExpanded={isStreamExpanded}
          onToggleStream={toggleStream}
          onLivenessChange={handleLiveness}
          isOffline={isOffline}
        />
      }
      rightSidebar={<Sidebar />}
      pageWideContent={
        !isOffline && isStreamExpanded ? (
          <LivestreamPlayer
            src={MTS_STREAM_SRC}
            title="MTS Live"
            isExpanded
            onToggleExpanded={toggleStream}
            onLivenessChange={handleLiveness}
            autoUnmute
          />
        ) : null
      }
    />
  )
}
