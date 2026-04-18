import './App.css'

const posts = [
  {
    title: 'I Built a youtube link to mp4 downloader EXE and You Should Try It!!!',
    date: 'Posted April 14, 2026 by Sacor',
    excerpt:
      'So I made this little tray app that just reminds you to drink water, but it yells at you in Comic Sans. Download it below and let me know how many hydration crimes it catches you committing!!! Haha jk, you should steal uncopyrighted from the internet with this, though.',
    thumbBorder: '#FF00FF',
  },
  {
    title: 'Why Salt Lake City Is Basically a Giant LAN Party in the Mountains',
    date: 'Posted April 2, 2026 by Sacor',
    excerpt:
      'A love letter to SLC gay bars, cold winters, and the people who keep nerding out with me about Theodore Roosevelt on the weekends. Also: I tried to LARP as a Utah College Republican. Results were mixed.',
    thumbBorder: '#00FFFF',
  },
  {
    title: 'Ranking Every 90s Snack I Can Still Actually Find',
    date: 'Posted March 21, 2026 by Sacor',
    excerpt:
      'Dunkaroos are BACK, Fruit Gushers never left, and I have STRONG opinions about Bagel Bites. Come fight me in the comments (that I haven\u2019t implemented yet).',
    thumbBorder: '#00FF00',
  },
  {
    title: 'Somebody needs to stop it now!!!',
    date: 'Posted March 8, 2026 by Sacor',
    excerpt:
      'Was it a good idea? Absolutely not. Did I learn a lot? Kind of. Did I? You bet I did!!! Link inside.',
    thumbBorder: '#FFFF00',
  },
]

const navLinks = ['HOME', 'ABOUT ME', 'BLOG POSTS', 'GUESTBOOK', 'LINKS', 'CONTACT']

export default function App() {
  return (
    <div className="geocities">
      {/* ============ TOP HEADER BANNER ============ */}
      <center>
        <table
          width="95%"
          cellPadding="10"
          cellSpacing="0"
          border="4"
          bgColor="#000000"
          className="header-table"
        >
          <tbody>
            <tr>
              <td align="center" bgColor="#4B0082">
                {/* <<< SWAP HEADER ANIMATED GIF HERE >>> */}
                <img
                  src="https://i.imgur.com/PLACEHOLDER_HEADER.gif"
                  alt="spinning globe"
                  width="64"
                  height="64"
                  border="0"
                  align="left"
                />
                <img
                  src="https://i.imgur.com/PLACEHOLDER_HEADER.gif"
                  alt="spinning globe"
                  width="64"
                  height="64"
                  border="0"
                  align="right"
                />
                <h1 className="glow">
                  <blink>WELCOME TO Sacor&rsquo;S GEOCITIES BLOG!!!</blink>
                </h1>
                <font face="Comic Sans MS" size="4" color="#00FFFF">
                  ~*~ Green Hill Zone ~*~ Where the 90s Never Die!!! ~*~
                </font>
                <br />
                <br />
                <marquee behavior="scroll" direction="left" scrollAmount="6" bgColor="#FFFF00" width="90%">
                  <font face="Impact" size="4" color="#FF00FF">
                    &#9733; Under Construction Since 1999... Just Kidding, It&rsquo;s 90s Forever!!! &#9733;
                    &nbsp;&nbsp;&nbsp; SIGN MY GUESTBOOK!!! &nbsp;&nbsp;&nbsp;
                    &#9829; THANKS FOR VISITING!!! &#9829;
                  </font>
                </marquee>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      {/* ============ MAIN 3-COLUMN LAYOUT ============ */}
      <center>
        <table width="95%" cellPadding="8" cellSpacing="6" border="0">
          <tbody>
            <tr valign="top">
              {/* ========== LEFT NAV SIDEBAR ========== */}
              <td width="18%" bgColor="#000080" className="left-sidebar">
                <center>
                  <font face="Impact" size="5" color="#FFFF00">
                    <blink>~ NAVIGATE ~</blink>
                  </font>
                  <br />
                  <br />
                  {/* <<< SWAP SIDEBAR ANIMATED GIF HERE >>> */}
                  <img
                    src="https://i.imgur.com/PLACEHOLDER_SIDEBAR.gif"
                    alt="construction worker"
                    width="90"
                    height="90"
                    border="3"
                    className="ridge-pink"
                  />
                  <br />
                  <br />
                </center>

                <table width="100%" cellPadding="0" cellSpacing="6" border="0">
                  <tbody>
                    {navLinks.map((label) => (
                      <tr key={label}>
                        <td className="navbtn">
                          <a href={`#${label.toLowerCase().replace(/\s+/g, '-')}`}>&#9733; {label} &#9733;</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <br />
                <center>
                  <font face="Comic Sans MS" size="2" color="#00FF00">
                    <blink>NEW!!!</blink>
                    <br />
                    Downloads &amp; Apps
                    <br />
                    coming soon!!!
                  </font>
                </center>
              </td>

              {/* ========== MAIN CONTENT ========== */}
              <td width="56%" bgColor="#2E0854" className="main-content">
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
                            <a href="#">Read More &rarr;</a>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <br />
                  </div>
                ))}
              </td>

              {/* ========== RIGHT SIDEBAR ========== */}
              <td width="26%">
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
                          since July 14, 1999
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
                            <li>
                              <a href="#">Ye Olde Blog Archive</a>
                            </li>
                            <li>
                              <a href="#">Downloadable EXEs</a>
                            </li>
                            <li>
                              <a href="#">My GitHub Dungeon</a>
                            </li>
                            <li>
                              <a href="#">90s Webring &#9733;</a>
                            </li>
                            <li>
                              <a href="#">Sonic Fan Pages</a>
                            </li>
                            <li>
                              <a href="#">Netscape Now!</a>
                            </li>
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
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      {/* ============ FOOTER ============ */}
      <center>
        <table width="95%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td className="footer">
                <marquee behavior="alternate" scrollAmount="4">
                  <font face="Courier New" size="2" color="#FF00FF">
                    &#9733; &#9733; &#9733; THANKS FOR VISITING!!! TELL YOUR FRIENDS!!! &#9733; &#9733; &#9733;
                  </font>
                </marquee>
                <br />
                <font face="Courier New" size="2" color="#00FF00">
                  &copy; 1999&ndash;2026 Sacor &nbsp;&bull;&nbsp; Made with{' '}
                  <b className="cyan">Microsoft FrontPage</b> &nbsp;&bull;&nbsp; Best viewed in{' '}
                  <b className="yellow">Netscape Navigator 4.7</b> at 800&times;600 &nbsp;&bull;&nbsp; Email me at{' '}
                  <a href="mailto:vestibule@sacor.xyz" className="yellow-link">
                    vestibule@sacor.xyz
                  </a>
                </font>
                <br />
                <br />
                <font face="Comic Sans MS" size="1" color="#FFFFFF">
                  This page is a member of the <b className="hotpink">Green Hill Zone Webring</b> &#9733;{' '}
                  <a href="#" className="cyan-link">[Prev]</a>{' '}
                  <a href="#" className="cyan-link">[Next]</a>{' '}
                  <a href="#" className="cyan-link">[Random]</a>{' '}
                  <a href="#" className="cyan-link">[List Sites]</a>
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />
    </div>
  )
}
