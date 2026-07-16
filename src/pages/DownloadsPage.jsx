import { Link } from 'react-router-dom'
import Layout from '../Layout'
import DownloadsNav from '../components/DownloadsNav'
import { DOWNLOAD_TOOLS } from '../data/downloadTools'

const rightSidebar = (
  <>
    {/* BACK TO HOME */}
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
              All my free download tools in one place!!!
              <br />
              <br />
            </font>
            <a href="/" className="navbtn-link">&#9733; BACK TO HOME &#9733;</a>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    {/* HEADS UP */}
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
      <tbody>
        <tr>
          <td align="center" bgcolor="#00FFFF" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ HEADS UP ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgcolor="#000000">
            <font face="Comic Sans MS" size="2" color="#00FF00">
              Public media only!!! Save stuff you own or have permission to download.
              Private or login-only posts are out of scope.
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
        <span className="blink">~*~ DOWNLOADS ~*~</span>
      </font>
    </center>

    <br />

    <DownloadsNav />

    {/* INTRO */}
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
      <tbody>
        <tr>
          <td>
            <font face="Comic Sans MS" size="3" color="#FFFFFF">
              Welcome to my download workshop!!! Pick a tool from the tabs above, or grab
              one from the grid below. Each one is <b className="lime">100% FREE</b> and
              runs right here in your browser — except <b className="yellow">YTMP4</b>,
              which is a real Windows app you download and keep!!!
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    {/* TOOL GRID */}
    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgcolor="#00FFFF" className="section-bar">
              <font face="Impact" size="4" color="#000000">
                ~ PICK YOUR POISON ~
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </center>

    <br />

    <table width="100%" cellPadding="6" cellSpacing="4" border="0">
      <tbody>
        {DOWNLOAD_TOOLS.map((t) => (
          <tr key={t.to}>
            <td className="navbtn" style={{ width: '42%' }}>
              <Link to={t.to}>
                <svg className="dl-tool-icon" aria-hidden="true">
                  <use href={`/icons.svg#${t.icon}`} />
                </svg>
                &#9733; {t.label} &#9733;
              </Link>
            </td>
            <td bgcolor="#000000" className="feature-row">
              <font face="Comic Sans MS" size="3" color="#FFFFFF">{t.blurb}</font>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <br />

    <center>
      <font face="Comic Sans MS" size="2" color="#888888">
        Public media only &nbsp;&#9733;&nbsp; Be cool, download responsibly &nbsp;&#9733;&nbsp;
        <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
      </font>
    </center>

    <br />
  </>
)

export default function DownloadsPage() {
  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
