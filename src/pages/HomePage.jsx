import { Link } from 'react-router-dom'
import Layout from '../Layout'

const posts = [
  {
    title: 'I Built a youtube link to mp4 downloader EXE and You Should Try It!!!',
    date: 'Posted April 14, 2026 by Sacor',
    excerpt:
      'So I made this little tray app that just reminds you to drink water, but it yells at you in Comic Sans. Download it below and let me know how many hydration crimes it catches you committing!!! Haha jk, you should steal uncopyrighted from the internet with this, though.',
    thumbBorder: '#FF00FF',
    link: '/ytmp4',
  },
  {
    title: 'Why Salt Lake City Is Basically a Giant LAN Party in the Mountains',
    date: 'Posted April 2, 2026 by Sacor',
    excerpt:
      'A love letter to SLC gay bars, cold winters, and the people who keep nerding out with me about Theodore Roosevelt on the weekends. Also: I tried to LARP as a Utah College Republican. Results were mixed.',
    thumbBorder: '#00FFFF',
    link: '#',
  },
  {
    title: 'Ranking Every 90s Snack I Can Still Actually Find',
    date: 'Posted March 21, 2026 by Sacor',
    excerpt:
      'Dunkaroos are BACK, Fruit Gushers never left, and I have STRONG opinions about Bagel Bites. Come fight me in the comments (that I haven\u2019t implemented yet).',
    thumbBorder: '#00FF00',
    link: '#',
  },
  {
    title: 'Somebody needs to stop it now!!!',
    date: 'Posted March 8, 2026 by Sacor',
    excerpt:
      'Was it a good idea? Absolutely not. Did I learn a lot? Kind of. Did I? You bet I did!!! Link inside.',
    thumbBorder: '#FFFF00',
    link: '#',
  },
]

const rightSidebar = (
  <>
    {/* ABOUT BOX */}
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
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
            {/* <<< SWAP ABOUT PHOTO/GIF HERE >>> */}
            <img
              src="https://i.imgur.com/PLACEHOLDER_ME.gif"
              alt="me"
              width="100"
              height="100"
              border="3"
              className="ridge-cyan"
            />
            <br />
            <br />
            <font face="Comic Sans MS" size="2" color="#FFFFFF">
              Howdy!!! I&rsquo;m <b className="cyan">Sacor</b>, coming at you LIVE from{' '}
              <b className="lime">Salt Lake City, Utah</b>!!! I write about{' '}
              <b className="yellow">tech</b>, <b className="hotpink">life</b>, and random{' '}
              <b className="cyan">90s nostalgia</b>. I also make weird little apps and exes for
              fun!!! Stay awhile &amp; listen!!!
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    {/* HIT COUNTER */}
    <table
      width="100%"
      cellPadding="8"
      cellSpacing="0"
      border="0"
      className="bevelbox"
      bgColor="#000000"
    >
      <tbody>
        <tr>
          <td align="center" bgColor="#00FF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ HIT COUNTER ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center" bgColor="#000000">
            <font face="Courier New" size="3" color="#00FF00">
              You are visitor #
            </font>
            <br />
            {/* <<< SWAP HIT COUNTER GIF HERE >>> */}
            <img
              src="https://i.imgur.com/PLACEHOLDER_COUNTER.gif"
              alt="00004269"
              width="140"
              height="30"
              border="2"
              className="inset-yellow"
            />
            <br />
            <font face="Courier New" size="2" color="#FFFF00">
              00004269
            </font>
            <br />
            <font face="Comic Sans MS" size="1" color="#FFFFFF">
              since July 4, 1776
            </font>
          </td>
        </tr>
      </tbody>
    </table>

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
                &quot;If the computer fan is loud enough, you ARE a hacker.&quot;
                <br />
                <br />
                &quot;Never trust a UI that doesn&rsquo;t have at least one &lt;blink&gt; tag.&quot;
                <br />
                <br />
                &quot;Ship the weird thing.&quot;
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
                <li><a href="#">Ye Olde Blog Archive</a></li>
                <li><Link to="/ytmp4">Downloadable EXEs</Link></li>
                <li><a href="#">My GitHub Dungeon</a></li>
                <li><a href="#">90s Webring &#9733;</a></li>
                <li><a href="#">Sonic Fan Pages</a></li>
                <li><a href="#">Netscape Now!</a></li>
              </ul>
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    <center>
      {/* <<< SWAP NETSCAPE BADGE GIF HERE >>> */}
      <img
        src="https://i.imgur.com/PLACEHOLDER_BADGE.gif"
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
        Hi there, web surfer!!!
      </font>
    </center>
    <br />
    <font face="Comic Sans MS" size="4" color="#FFFFFF">
      <font color="#FFFF00">&#9733;</font> Welcome welcome WELCOME to my little corner of the World
      Wide Web!!! My name is <b className="hotpink">Sacor</b> and this is where I post my{' '}
      <i className="cyan">ramblings</i>, weird thoughts, and all the{' '}
      <b className="lime">random apps and deployable executables</b> I make for YOU to download for
      FREE!!! <font color="#FFFF00">&#9733;</font>
      <br />
      <br />
      Grab a Surge soda, crank up some Smash Mouth, and stick around awhile!!! Don&rsquo;t forget to{' '}
      <blink>
        <font color="#00FF00">SIGN MY GUESTBOOK</font>
      </blink>{' '}
      before you leave!!!
    </font>

    <br />
    <br />

    {/* ====== LATEST RAMBLINGS ====== */}
    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgColor="#FF00FF" className="section-bar">
              <font face="Impact" size="5" color="#FFFF00">
                <blink>~*~ LATEST RAMBLINGS ~*~</blink>
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </center>

    <br />

    {posts.map((post, i) => (
      <div key={post.title}>
        <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
          <tbody>
            <tr valign="top">
              <td width="90">
                {/* <<< SWAP POST THUMBNAIL HERE >>> */}
                <img
                  src={`https://i.imgur.com/PLACEHOLDER_THUMB${i + 1}.gif`}
                  alt="thumb"
                  width="80"
                  height="80"
                  border="3"
                  style={{ borderStyle: 'ridge', borderColor: post.thumbBorder }}
                />
              </td>
              <td>
                <span className="posttitle">{post.title}</span>
                <br />
                <font face="Arial" size="2" color="#FFFF00">
                  {post.date}
                </font>
                <br />
                <br />
                <font face="Comic Sans MS" size="3" color="#FFFFFF">
                  {post.excerpt}
                </font>
                <br />
                <br />
                {post.link.startsWith('/') ? (
                  <Link to={post.link}>Read More &rarr;</Link>
                ) : (
                  <a href={post.link}>Read More &rarr;</a>
                )}
              </td>
            </tr>
          </tbody>
        </table>
        <br />
      </div>
    ))}
  </>
)

export default function HomePage() {
  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
