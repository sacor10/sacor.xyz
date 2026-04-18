import { Link } from 'react-router-dom'
import './App.css'

const navLinks = [
  { label: 'HOME',       to: '/' },
  { label: 'ABOUT ME',   to: '/#about-me' },
  { label: 'BLOG POSTS', to: '/#blog-posts' },
  { label: 'DOWNLOADS',  to: '/ytmp4' },
  { label: 'GUESTBOOK',  to: '/#guestbook' },
  { label: 'CONTACT',    to: '/#contact' },
]

export default function Layout({ mainContent, rightSidebar }) {
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
                    &#9733; Under Construction Since 1998... Just Kidding, It&rsquo;s 90s Forever!!! &#9733;
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
                    {navLinks.map((nav) => (
                      <tr key={nav.label}>
                        <td className="navbtn">
                          <Link to={nav.to}>&#9733; {nav.label} &#9733;</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>

              {/* ========== MAIN + RIGHT CONTENT ========== */}
              <td width="56%" bgColor="#2E0854" className="main-content">
                {mainContent}
              </td>

              <td width="26%">
                {rightSidebar}
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
