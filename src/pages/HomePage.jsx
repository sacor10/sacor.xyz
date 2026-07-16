import { Link } from 'react-router-dom'
import Layout from '../Layout'
import HitCounter from '../components/HitCounter'
import { DOWNLOAD_TOOLS } from '../data/downloadTools'
import { pinnedQuotes } from '../data/quotes'

const quotePreview = pinnedQuotes.slice(0, 3)

// Other corners of the site worth wandering into, shown as a little link grid on
// the home page.
const EXPLORE_LINKS = [
  { label: 'SLOP BLOG',   to: '/blog',      blurb: 'Ramblings, nostalgia, and half-baked tech takes' },
  { label: 'QUOTES',      to: '/quotes',    blurb: 'Wisdom & nonsense from folks smarter than me' },
  { label: 'LIVE STOCKS', to: '/stocks',    blurb: 'Watch the numbers go up (and down) in real time' },
  { label: 'STUMBLE!',    to: '/stumble',   blurb: 'Roll the dice and get yeeted to a random site', icon: '🎲' },
  { label: 'WEBRING',     to: '/webring',   blurb: 'Join the Green Hill Zone webring VIRUS', icon: '💍' },
  { label: 'GUESTBOOK',   to: '/guestbook', blurb: 'SIGN IT or be cursed for seven long years' },
  { label: 'EASTON',      to: '/easton',    blurb: 'A humble shrine to my friend Easton', icon: '☺' },
]

const rightSidebar = (
  <>
    {/* ABOUT BOX */}
    <table id="about-me" width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
      <tbody>
        <tr>
          <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
            <font face="Impact" size="4" color="#FFFF00">
              ~ ABOUT Sacor ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center">
            <img
              src="/generated-assets/avatar-v2.png"
              alt="me"
              width="100"
              height="100"
              border="3"
              className="ridge-cyan"
            />
            <br />
            <br />
            <font face="Comic Sans MS" size="2" color="#FFFFFF">
              Girl hey. I&rsquo;m <b className="cyan">Sacor</b>, coming at you from{' '}
              <b className="lime">Salt Lake City, Utah</b>! I write about{' '}
              <b className="yellow">tech</b>, <b className="hotpink">life</b>, and random{' '}
              <b className="cyan">American nostalgia</b>. I also make weird little apps and exes for
              fun!
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    {/* HIT COUNTER */}
    <HitCounter />

    <br />

    {/* QUOTES FROM OTHERS */}
    <table
      width="100%"
      cellPadding="8"
      cellSpacing="0"
      border="0"
      className="bevelbox"
      bgcolor="#4B0082"
    >
      <tbody>
        <tr>
          <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ QUOTES FROM OTHERS ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgcolor="#000000">
            <marquee behavior="scroll" direction="up" scrollamount="2" height="80">
              <font face="Comic Sans MS" size="3" color="#00FFFF">
                {quotePreview.map((quote, index) => (
                  <span key={quote.id}>
                    <span style={{ whiteSpace: 'pre-line' }}>&quot;{quote.text}&quot;</span>
                    <br />
                    <font face="Courier New" size="2" color="#FFFF00">
                      - {quote.speaker}
                    </font>
                    {index < quotePreview.length - 1 && (
                      <>
                        <br />
                        <br />
                      </>
                    )}
                  </span>
                ))}
              </font>
            </marquee>
            <br />
            <center>
              <Link to="/quotes" className="navbtn-link">&#9733; MORE QUOTES &#9733;</Link>
            </center>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    {/* FAVORITE LINKS */}
    <table
      width="100%"
      cellPadding="8"
      cellSpacing="0"
      border="0"
      className="bevelbox"
      bgcolor="#000080"
    >
      <tbody>
        <tr>
          <td align="center" bgcolor="#00FFFF" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ MY FAVORITE LINKS ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgcolor="#FFFFFF">
            <font face="Times New Roman" size="3" color="#000000">
              <ul className="favlinks">
                <li><Link to="/blog">Slop Blog Archive</Link></li>
                <li><Link to="/ytmp4">Downloadable EXEs</Link></li>
                <li><Link to="/instagram-downloader">Instagram Video Downloader</Link></li>
                <li><Link to="/x-downloader">X Video Downloader</Link></li>
                <li><Link to="/linkedin-downloader">LinkedIn Video Downloader</Link></li>
                <li><a href="https://github.com/sacor10/" target="_blank" rel="noopener noreferrer">My GitHub Dungeon</a></li>
                <li><Link to="/webring">Parasitic Webring VIRUS &#9733;</Link></li>
                <li><a href="https://sonicretro.org" target="_blank" rel="noopener noreferrer">Fan Pages</a></li>
                <li><a href="https://web.archive.org/web/19961220021530/http://home.netscape.com/" target="_blank" rel="noopener noreferrer">Serenity Now!</a></li>
              </ul>
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    <center>
      <img
        src="/generated-assets/browser-badge-v2.png"
        alt="Netscape Now"
        width="88"
        height="31"
        border="0"
      />
      <br />
      <br />
      <font face="Comic Sans MS" size="2" color="#FFFF00">
        <span className="blink">SIGN MY GUESTBOOK!!!</span>
      </font>
    </center>
  </>
)

const mainContent = (
  <>
    <center>
      <font face="Impact" size="6" color="#00FFFF" className="hero-glow">
        this is Sacor.xyz
      </font>
    </center>
    <br />
    <font face="Comic Sans MS" size="4" color="#FFFFFF">
      <font color="#FFFF00">&#9733;</font> Welcome from <b className="hotpink">Sacor</b> and this is where I post my{' '}
      <i className="cyan">ramblings</i>, REDACTED, and all the{' '}
      <b className="lime">random apps and deployable executables</b> I make for YOU to download for
      a FEE! If you can find the fee... <font color="#FFFF00">&#9733;</font>
      <br />
      <br />
      Grab a salami lid, crank up some naked flames, and stick around awhile! Don&rsquo;t forget to{' '}
      <span className="blink">
        <font color="#00FF00">SIGN MY GUESTBOOK</font>
      </span>{' '}
      before you depart this realm.
    </font>

    <br />
    <br />

    <center>
      <marquee behavior="scroll" direction="left" scrollamount="5" bgcolor="#000000" width="100%">
        <font face="Impact" size="4" color="#FF00FF">
          &#9733; FREE TOOLS &#9733; NO ADS &#9733; NO SIGNUP &#9733; RUNS IN YOUR BROWSER &#9733;
          BUILT BY A REAL HUMAN &#9733; PROBABLY &#9733;
        </font>
      </marquee>
    </center>

    <br />

    {/* ====== DOWNLOAD WORKSHOP ====== */}
    <center>
      <font face="Impact" size="6" color="#FF00FF" className="hero-glow">
        <span className="blink">~*~ SACOR&rsquo;S DOWNLOAD WORKSHOP ~*~</span>
      </font>
    </center>

    <br />

    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
      <tbody>
        <tr>
          <td>
            <font face="Comic Sans MS" size="3" color="#FFFFFF">
              The main event!!! A pile of <b className="lime">weird little apps</b> I built to yoink
              public videos off the internet &mdash; plus <b className="yellow">YTMP4</b>, a real
              Windows <b className="cyan">.EXE</b> you download and keep forever. All{' '}
              <b className="hotpink">100% FREE</b>. Pick your poison:
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
      <Link to="/downloads" className="navbtn-link">&#9733; SEE THE WHOLE DOWNLOAD SHELF &#9733;</Link>
    </center>

    <br />
    <br />

    {/* ====== THE REST OF THE JUNK DRAWER ====== */}
    <center>
      <font face="Impact" size="6" color="#FF00FF" className="hero-glow">
        ~*~ THE REST OF THE JUNK DRAWER ~*~
      </font>
    </center>

    <br />

    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FF00FF" className="section-bar">
              <font face="Impact" size="4" color="#FFFF00">
                ~ POKE AROUND ~
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </center>

    <br />

    <table width="100%" cellPadding="6" cellSpacing="4" border="0">
      <tbody>
        {EXPLORE_LINKS.map((link) => (
          <tr key={link.to}>
            <td className="navbtn" style={{ width: '42%' }}>
              <Link to={link.to}>
                {link.icon || <>&#9733;</>} {link.label} {link.icon || <>&#9733;</>}
              </Link>
            </td>
            <td bgcolor="#000000" className="feature-row">
              <font face="Comic Sans MS" size="3" color="#FFFFFF">{link.blurb}</font>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <br />

    <center>
      <font face="Comic Sans MS" size="2" color="#888888">
        Made with love, spite, and too much free time &nbsp;&#9733;&nbsp;
        <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
      </font>
    </center>

    <br />
  </>
)

export default function HomePage() {
  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
