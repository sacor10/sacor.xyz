import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../Layout'
import HitCounter from '../components/HitCounter'
import {
  LivestreamPlayer,
  LivestreamWideNotice,
  LivestreamOfflineNotice,
} from '../components/LivestreamPlayer'
import { useYoutubeLive, livestreamEmbedSrc } from '../hooks/useYoutubeLive'
import { pinnedQuotes } from '../data/quotes'

const ROOSEVELT_CHANNEL_ID = 'UCrrkptlW7UtbiUHFjdsfKPg'
const ROOSEVELT_LIVE_URL = `https://www.youtube.com/channel/${ROOSEVELT_CHANNEL_ID}/live`
const quotePreview = pinnedQuotes.slice(0, 3)

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

function MainContent({ isStreamExpanded, onToggleStream, streamSrc, streamStatus }) {
  return (
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

    {/* ====== ROOSEVELT MEMORIAL LIVESTREAM ====== */}
    <center>
      <font face="Impact" size="6" color="#FF00FF" className="hero-glow">
        <span className="blink">~*~ LIVE FROM THE BOONE & CROCKETT CLUB ~*~</span>
      </font>
    </center>

    <br />

    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FF00FF" className="section-bar">
              <font face="Impact" size="5" color="#FFFF00">
                ~*~ THEODORE ROOSEVELT MEMORIAL RANCH ~*~
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
              The <b className="lime">Boone and Crockett Club</b> &mdash; founded by{' '}
              <b className="cyan">Theodore Roosevelt</b> in <b className="yellow">1887</b> &mdash; hosts a 24/7 livestream of{' '}
              <b className="hotpink">Theodore Roosevelt Memorial Ranch</b>
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

    {streamStatus === 'live' ? (
      isStreamExpanded ? (
        <LivestreamWideNotice
          title="Theodore Roosevelt Memorial Live"
          onCollapse={onToggleStream}
        />
      ) : (
        <LivestreamPlayer
          src={streamSrc}
          title="Theodore Roosevelt Memorial Live"
          isExpanded={false}
          onToggleExpanded={onToggleStream}
        />
      )
    ) : (
      <LivestreamOfflineNotice
        title="Theodore Roosevelt Memorial Live"
        status={streamStatus}
        watchUrl={ROOSEVELT_LIVE_URL}
        note="The memorial feed is off the air right now — check back soon!!!"
      />
    )}

    <br />

    <center>
      <font face="Comic Sans MS" size="2" color="#888888">
        Stream courtesy of the{' '}
        <a href="https://www.boone-crockett.org/" target="_blank" rel="noreferrer">
          Boone and Crockett Club
        </a>
        &nbsp;&#9733;&nbsp; <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
      </font>
    </center>

    <br />
  </>
  )
}

export default function HomePage() {
  const [isStreamExpanded, setIsStreamExpanded] = useState(false)
  const toggleStream = () => setIsStreamExpanded((expanded) => !expanded)

  const { status, videoId } = useYoutubeLive(ROOSEVELT_CHANNEL_ID)
  const isLive = status === 'live'
  const streamSrc = isLive ? livestreamEmbedSrc(videoId) : null

  return (
    <Layout
      mainContent={
        <MainContent
          isStreamExpanded={isStreamExpanded}
          onToggleStream={toggleStream}
          streamSrc={streamSrc}
          streamStatus={status}
        />
      }
      rightSidebar={rightSidebar}
      pageWideContent={
        isLive && isStreamExpanded ? (
          <LivestreamPlayer
            src={streamSrc}
            title="Theodore Roosevelt Memorial Live"
            isExpanded
            onToggleExpanded={toggleStream}
          />
        ) : null
      }
    />
  )
}
