import { Link } from 'react-router-dom'
import Layout from '../Layout'

const entries = [
  {
    name: 'Xx_DarkSephiroth_xX',
    date: 'August 12, 1999',
    location: 'Phoenix, AZ',
    message:
      'THIS PAGE RULES!!! Finally a site that doesn\u2019t suck!!! Check out my page on Angelfire it is mostly about FFVII sprites. Peace out!!!',
    color: '#FF00FF',
  },
  {
    name: 'Jennifer',
    date: 'March 4, 2001',
    location: 'somewhere in Ohio',
    message:
      'hey i found this on altavista, very cool layout \u2665 my sister says the <blink> hurts her eyes but i think she is a hater. keep it up!!! <3 <3 <3',
    color: '#00FFFF',
  },
  {
    name: 'mr_t1993',
    date: 'November 21, 2003',
    location: 'Milwaukee, WI',
    message:
      'was looking for cheats for sonic adventure 2 and somehow ended up here. not mad about it. bookmarking with Netscape.',
    color: '#FFFF00',
  },
  {
    name: 'Ada',
    date: 'September 8, 2024',
    location: 'Brooklyn, NY',
    message:
      'Found this via a Mastodon link. Deeply confused but delighted. Please never change. I am forwarding this to everyone I know.',
    color: '#00FF00',
  },
  {
    name: 'a ghost',
    date: 'February 14, 2026',
    location: 'the internet',
    message:
      'I cannot believe <blink> still works in the year of our lord 2026. The web was a mistake. This page was not.',
    color: '#FF6699',
  },
  {
    name: 'YOU?',
    date: 'whenever',
    location: 'somewhere cool',
    message:
      'Email me at vestibule@sacor.xyz with subject "SIGN GUESTBOOK" and I\u2019ll add your entry. Yes this is a guestbook powered by me manually editing a file. Yes it is on-brand.',
    color: '#FFFFFF',
    pending: true,
  },
]

const rightSidebar = (
  <>
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
      <tbody>
        <tr>
          <td align="center" bgColor="#FF00FF" className="section-bar-sm">
            <font face="Impact" size="4" color="#FFFF00">
              ~ NAVIGATE ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center">
            <Link to="/" className="navbtn-link">&#9733; BACK TO HOME &#9733;</Link>
            <br />
            <br />
            <Link to="/contact" className="navbtn-link">&#9733; CONTACT ME &#9733;</Link>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

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
          <td align="center" bgColor="#FFFF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ HOUSE RULES ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgColor="#000000">
            <font face="Comic Sans MS" size="2" color="#FFFFFF">
              <ol style={{ paddingLeft: '18px', margin: 0 }}>
                <li>Be kind!!!</li>
                <li>No spam!!!</li>
                <li>No crypto!!!</li>
                <li>Weird is encouraged!!!</li>
                <li>At least one exclamation point!!!</li>
              </ol>
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

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
          <td align="center" bgColor="#00FFFF" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ STATS ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center" bgColor="#000000">
            <font face="Courier New" size="2" color="#00FF00">
              <b className="yellow">Total signatures:</b>{' '}
              {entries.filter((e) => !e.pending).length}
              <br />
              <b className="yellow">Spam filtered:</b> 2,841
              <br />
              <b className="yellow">Crypto bros blocked:</b> <blink>&infin;</blink>
              <br />
              <b className="yellow">Vibes:</b> immaculate
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
      <font face="Impact" size="6" color="#00FFFF" className="hero-glow">
        &#9733; SIGN MY GUESTBOOK &#9733;
      </font>
      <br />
      <font face="Comic Sans MS" size="3" color="#FFFF00">
        <blink>~ Leave a message for all of posterity!!! ~</blink>
      </font>
    </center>

    <br />

    <font face="Comic Sans MS" size="3" color="#FFFFFF">
      Welcome to the <b className="hotpink">Sacor.xyz Guestbook</b>, established in{' '}
      <b className="cyan">1998</b> (spiritually). Below you will find the sacred scrolls of
      everyone who has ever stopped by to say hi. To add your own, email me &mdash; see below the
      entries.
    </font>

    <br />
    <br />

    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgColor="#FF00FF" className="section-bar">
              <font face="Impact" size="5" color="#FFFF00">
                <blink>~*~ ENTRIES ~*~</blink>
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </center>

    <br />

    {entries.map((entry, i) => (
      <div key={i}>
        <table
          width="100%"
          cellPadding="8"
          cellSpacing="0"
          border="0"
          className="postbox"
          style={{ borderLeft: `6px solid ${entry.color}` }}
        >
          <tbody>
            <tr valign="top">
              <td>
                <font face="Impact" size="4" color={entry.color}>
                  {entry.pending ? '~ YOU COULD BE HERE ~' : entry.name}
                </font>
                <br />
                <font face="Courier New" size="2" color="#FFFF00">
                  {entry.date} &nbsp;&bull;&nbsp; {entry.location}
                </font>
                <br />
                <br />
                <font face="Comic Sans MS" size="3" color="#FFFFFF">
                  {entry.message}
                </font>
              </td>
            </tr>
          </tbody>
        </table>
        <br />
      </div>
    ))}

    <center>
      <table width="100%" cellPadding="12" cellSpacing="0" border="0" className="postbox" bgColor="#000000">
        <tbody>
          <tr>
            <td align="center" bgColor="#00FF00" className="section-bar-sm">
              <font face="Impact" size="5" color="#000000">
                <blink>~*~ SIGN HERE ~*~</blink>
              </font>
            </td>
          </tr>
          <tr>
            <td align="center" bgColor="#000000">
              <br />
              <font face="Comic Sans MS" size="3" color="#FFFFFF">
                Want to be immortalized? Email me!!!
              </font>
              <br />
              <br />
              <font face="Courier New" size="4" color="#00FF00">
                <a href="mailto:vestibule@sacor.xyz?subject=SIGN%20GUESTBOOK" className="yellow-link">
                  vestibule@sacor.xyz
                </a>
              </font>
              <br />
              <br />
              <font face="Comic Sans MS" size="2" color="#FFFF00">
                Subject line: <b>SIGN GUESTBOOK</b>
                <br />
                Include: a name, a location (real or fake), and a message.
              </font>
              <br />
              <br />
            </td>
          </tr>
        </tbody>
      </table>
    </center>
  </>
)

export default function GuestbookPage() {
  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
