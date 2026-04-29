import { Link } from 'react-router-dom'
import Layout from '../Layout'
import HitCounter from '../components/HitCounter'

const ROOSEVELT_CHANNEL_ID = 'UCrrkptlW7UtbiUHFjdsfKPg'

const rightSidebar = (
  <>
    {/* ABOUT BOX */}
    <table id="about-me" width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
      <tbody>
        <tr>
          <td align="center" bgColor="#FF00FF" className="section-bar-sm">
            <font face="Impact" size="4" color="#FFFF00">
              ~ ABOUT Sacor ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center">
            <img
              src="/placeholders/me.svg"
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

    {/* RANDOM THOUGHT */}
    <table
      width="100%"
      cellPadding="8"
      cellSpacing="0"
      border="0"
      className="bevelbox"
      bgColor="#4B0082"
    >
      <tbody>
        <tr>
          <td align="center" bgColor="#FFFF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ THOUGHT OF THE DAY ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgColor="#000000">
            <marquee behavior="scroll" direction="up" scrollAmount="2" height="80">
              <font face="Comic Sans MS" size="3" color="#00FFFF">
                &quot;Tum tum is full.&quot;
                <br />
                <br />
                &quot;There is no more infnantile mindset than the belief that one day the hard work will just be over or that nothing but pleasure and hedonistic relaxation await.&quot;
                <br />
                <br />
                &quot;Let me know when you get home safe.&quot;
              </font>
            </marquee>
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
      bgColor="#000080"
    >
      <tbody>
        <tr>
          <td align="center" bgColor="#00FFFF" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ MY FAVORITE LINKS ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgColor="#FFFFFF">
            <font face="Times New Roman" size="3" color="#000000">
              <ul className="favlinks">
                <li><Link to="/blog">Slop Blog Archive</Link></li>
                <li><Link to="/ytmp4">Downloadable EXEs</Link></li>
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
        src="/placeholders/netscape.svg"
        alt="Netscape Now"
        width="88"
        height="31"
        border="0"
      />
      <br />
      <br />
      <font face="Comic Sans MS" size="2" color="#FFFF00">
        <blink>SIGN MY GUESTBOOK!!!</blink>
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
      <blink>
        <font color="#00FF00">SIGN MY GUESTBOOK</font>
      </blink>{' '}
      before you depart this realm.
    </font>

    <br />
    <br />

    {/* ====== ROOSEVELT MEMORIAL LIVESTREAM ====== */}
    <center>
      <font face="Impact" size="6" color="#FF00FF" className="hero-glow">
        <blink>~*~ LIVE FROM THE BOONE & CROCKETT CLUB ~*~</blink>
      </font>
    </center>

    <br />

    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgColor="#FF00FF" className="section-bar">
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
              <b className="cyan">Theodore Roosevelt</b> in <b className="yellow">1887</b> &mdash; hosts a 24/7 livestream of 
              
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
            <div
              style={{
                position: 'relative',
                width: '100%',
                paddingTop: '56.25%',
              }}
            >
              <iframe
                src={`https://www.youtube.com/embed/live_stream?channel=${ROOSEVELT_CHANNEL_ID}&autoplay=1&mute=1&modestbranding=1&rel=0&playsinline=1`}
                title="Theodore Roosevelt Memorial Live"
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
          </td>
        </tr>
      </tbody>
    </table>

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

export default function HomePage() {
  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
