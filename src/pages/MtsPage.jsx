import { useEffect } from 'react'
import Layout from '../Layout'

const WIDGETS_SRC = 'https://platform.twitter.com/widgets.js'

function loadTwitterWidgets() {
  if (typeof window === 'undefined') return
  if (window.twttr?.widgets?.load) {
    window.twttr.widgets.load()
    return
  }
  if (document.querySelector(`script[src="${WIDGETS_SRC}"]`)) return
  const script = document.createElement('script')
  script.src = WIDGETS_SRC
  script.async = true
  script.charset = 'utf-8'
  document.body.appendChild(script)
}

const rightSidebar = (
  <>
    {/* BACK TO HOME */}
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

    {/* ABOUT MTS */}
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
              <b className="yellow">MTS</b> = Monitoring The Situation
              <br />
              <br />
              An always-on newsroom for whatever is happening{' '}
              <b className="hotpink">right now</b> on the timeline.
              <br />
              <br />
              <font color="#FFFF00">Backed by a16z!!!</font>
              <br />
              <br />
              <a
                href="https://x.com/MTSlive"
                target="_blank"
                rel="noreferrer"
                className="navbtn-link"
              >
                &#9733; OPEN ON X &#9733;
              </a>
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    {/* HOW TO LISTEN */}
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgColor="#4B0082">
      <tbody>
        <tr>
          <td align="center" bgColor="#FFFF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ HOW TO LISTEN ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgColor="#000000">
            <font face="Comic Sans MS" size="2" color="#00FFFF">
              <b className="yellow">1.</b> Find the LIVE card at the top of the feed
              <br />
              <b className="yellow">2.</b> Click play
              <br />
              <b className="yellow">3.</b> Click the <b className="hotpink">unmute</b> icon
              <br />
              <br />
              <font color="#FF00FF">(your browser blocks autoplay sound!!!)</font>
            </font>
          </td>
        </tr>
      </tbody>
    </table>
  </>
)

const mainContent = (
  <>
    <center>
      <font face="Impact" size="6" color="#FF00FF" className="hero-glow">
        <blink>~*~ LIVE FROM @MTSLIVE ~*~</blink>
      </font>
    </center>

    <br />

    {/* TITLE SECTION BAR */}
    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgColor="#FF00FF" className="section-bar">
              <font face="Impact" size="5" color="#FFFF00">
                ~*~ MONITORING THE SITUATION ~*~
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </center>

    <br />

    {/* DESCRIPTION */}
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
      <tbody>
        <tr>
          <td>
            <font face="Comic Sans MS" size="3" color="#FFFFFF">
              <b className="lime">@MTSlive</b> is the first timeline-native, always-on
              news network &mdash; a livestream host bouncing between X, Kalshi, and
              Wikipedia, locking onto whatever the{' '}
              <b className="hotpink">current thing</b> happens to be!!!
              <br />
              <br />
              I plugged their feed in below so you can{' '}
              <b className="yellow">watch and listen RIGHT HERE</b> without leaving
              Sacor&rsquo;s Space!!! No X account needed!!!
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    {/* LIVE FEED SECTION BAR */}
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

    {/* TWITTER TIMELINE EMBED */}
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgColor="#000000">
      <tbody>
        <tr>
          <td bgColor="#000000">
            <div style={{ minHeight: '400px' }}>
              <a
                className="twitter-timeline"
                data-theme="dark"
                data-chrome="noheader nofooter noborders transparent"
                data-tweet-limit="5"
                href="https://twitter.com/MTSlive"
              >
                Loading @MTSlive...
              </a>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    <center>
      <font face="Comic Sans MS" size="2" color="#888888">
        Embed powered by X widgets &nbsp;&#9733;&nbsp; Live cards appear when MTS is on-air
        &nbsp;&#9733;&nbsp; <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
      </font>
    </center>

    <br />
  </>
)

export default function MtsPage() {
  useEffect(() => {
    loadTwitterWidgets()
  }, [])

  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
