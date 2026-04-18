import { Link } from 'react-router-dom'
import Layout from '../Layout'

const members = [
  {
    rank: 1,
    name: 'sacor.xyz',
    url: '/',
    desc: 'The site you are on right now!!! Home of Sacor, the youtube-link-to-mp4 downloader, and strong Dunkaroo opinions.',
    status: 'ACTIVE',
    joined: 'Founded 1998 (retroactively)',
  },
]

const rightSidebar = (
  <>
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
      <tbody>
        <tr>
          <td align="center" bgColor="#FF00FF" className="section-bar-sm">
            <font face="Impact" size="4" color="#FFFF00">
              ~ RING STATS ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center">
            <font face="Courier New" size="2" color="#FFFFFF">
              <b className="yellow">Members:</b> 1
              <br />
              <b className="yellow">Applications:</b> 0
              <br />
              <b className="yellow">Approved:</b> 0
              <br />
              <b className="yellow">Rejected:</b> 0
              <br />
              <b className="yellow">Status:</b>{' '}
              <font color="#00FF00">
                <blink>OPERATIONAL</blink>
              </font>
              <br />
              <b className="yellow">Uptime:</b> 100%
              <br />
              <br />
              <font size="1" color="#00FFFF">
                (100% uptime is easy when there is exactly one site in the ring and it is the one you are reading.)
              </font>
            </font>
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
              ~ APPLY TO JOIN ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgColor="#000000" align="center">
            <font face="Comic Sans MS" size="2" color="#FFFF00">
              Email <a href="mailto:vestibule@sacor.xyz" className="cyan-link">vestibule@sacor.xyz</a>{' '}
              with the subject line <b className="hotpink">&quot;LET ME IN THE RING&quot;</b> and:
              <br />
              <br />
              <font size="1" color="#FFFFFF" face="Courier New">
                1. your URL
                <br />
                2. at least one &lt;marquee&gt;
                <br />
                3. a hit counter (real or fake)
                <br />
                4. no dark mode
              </font>
              <br />
              <br />
              <font size="1" color="#00FF00">
                Applications reviewed when I feel like it.
              </font>
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
      <tbody>
        <tr>
          <td align="center" bgColor="#FFFF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ NAVIGATE ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center">
            <Link to="/" className="navbtn-link">&#9733; BACK TO HOME &#9733;</Link>
          </td>
        </tr>
      </tbody>
    </table>
  </>
)

const mainContent = (
  <>
    <center>
      <font face="Impact" size="6" color="#00FFFF" className="hero-glow">
        &#9733; GREEN HILL ZONE WEBRING &#9733;
      </font>
      <br />
      <font face="Comic Sans MS" size="3" color="#FFFF00">
        <blink>~*~ Est. 2026, vibes Est. 1998 ~*~</blink>
      </font>
    </center>

    <br />

    <font face="Comic Sans MS" size="3" color="#FFFFFF">
      Welcome to the <b className="hotpink">Green Hill Zone Webring</b>, a proud member-run circle of
      the finest sites on the World Wide Web. Click <b className="cyan">[Prev]</b>,{' '}
      <b className="cyan">[Next]</b>, or <b className="cyan">[Random]</b> down in the footer to
      surf between member sites.
      <br />
      <br />
      <font color="#FFFF00">
        <b>Full disclosure:</b>
      </font>{' '}
      there is currently <b className="lime">one (1)</b> member site, and you are looking at it.
      So [Prev], [Next], and [Random] all go to the same place. That place is <i>here</i>. You&rsquo;ve
      arrived. Welcome home.
    </font>

    <br />
    <br />

    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgColor="#FF00FF" className="section-bar">
              <font face="Impact" size="5" color="#FFFF00">
                <blink>~*~ MEMBER SITES ~*~</blink>
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </center>

    <br />

    {members.map((m) => (
      <table
        key={m.name}
        width="100%"
        cellPadding="8"
        cellSpacing="0"
        border="0"
        className="postbox"
      >
        <tbody>
          <tr valign="top">
            <td width="70" align="center">
              <font face="Impact" size="6" color="#FFFF00">
                #{m.rank}
              </font>
            </td>
            <td>
              <span className="posttitle">{m.name}</span>
              <br />
              <font face="Arial" size="2" color="#FFFF00">
                {m.joined} &nbsp;&bull;&nbsp; Status:{' '}
                <font color="#00FF00">
                  <b>{m.status}</b>
                </font>
              </font>
              <br />
              <br />
              <font face="Comic Sans MS" size="3" color="#FFFFFF">
                {m.desc}
              </font>
              <br />
              <br />
              <Link to={m.url}>Visit Site &rarr;</Link>
            </td>
          </tr>
        </tbody>
      </table>
    ))}

    <br />

    <center>
      <font face="Comic Sans MS" size="2" color="#00FFFF">
        &#9733; End of ring. You&rsquo;ve seen everything. Go outside. &#9733;
      </font>
    </center>
  </>
)

export default function WebringPage() {
  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
