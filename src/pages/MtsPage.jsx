import Layout from '../Layout'

const rightSidebar = (
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
              <a
                href="https://www.mts.now/"
                target="_blank"
                rel="noreferrer"
                className="navbtn-link"
              >
                &#9733; OPEN mts.now &#9733;
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
              ~ HOW TO LISTEN ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgColor="#000000" align="center">
            <font face="Comic Sans MS" size="2" color="#00FFFF">
              <b className="yellow">1.</b> Click play in the embedded player
              <br />
              <b className="yellow">2.</b> Click the <b className="hotpink">unmute</b> icon
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

    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgColor="#FF00FF" className="section-bar">
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
              <b className="hotpink">09:00 PT weekdays</b>. The official mts.now
              player is plugged in below, ticker and all!!! No X account needed,
              <b className="yellow"> no YouTube account needed</b>!!!
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

    <table width="100%" cellPadding="0" cellSpacing="0" border="0" className="bevelbox" bgColor="#000000">
      <tbody>
        <tr>
          <td bgColor="#000000" style={{ padding: 0 }}>
            <iframe
              src="https://www.mts.now/"
              title="MTS Live"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              style={{
                display: 'block',
                width: '100%',
                height: '900px',
                border: 0,
                background: '#0c0c10',
              }}
            />
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    <center>
      <font face="Comic Sans MS" size="2" color="#888888">
        Embedded from <a href="https://www.mts.now/">mts.now</a>
        &nbsp;&#9733;&nbsp; <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
      </font>
    </center>

    <br />
  </>
)

export default function MtsPage() {
  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
