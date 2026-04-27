import { Link } from 'react-router-dom'
import Layout from '../Layout'

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
            <Link to="/guestbook" className="navbtn-link">&#9733; GUESTBOOK &#9733;</Link>
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
          <td align="center" bgColor="#00FF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ BEST USED WITH ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgColor="#000000" align="center">
            <font face="Courier New" size="2" color="#00FF00">
              <b className="yellow">Mail client:</b> Outlook Express 5
              <br />
              <b className="yellow">Baud rate:</b> 56k or faster
              <br />
              <b className="yellow">Subject line:</b> lowercase, slightly ominous
              <br />
              <b className="yellow">Attachments:</b> zip file inside a zip file
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
        &#9733; CONTACT SACOR &#9733;
      </font>
      <br />
      <font face="Comic Sans MS" size="3" color="#FFFF00">
        <blink>~ Reach out! I do not bite everybody. ~</blink>
      </font>
    </center>

    <br />

    <font face="Comic Sans MS" size="3" color="#FFFFFF">
      So you want to <b className="hotpink">email me</b>, <b className="cyan">follow me</b>, or{' '}
      <b className="lime">yell at me on the internet</b>? Wonderful! Here are some the ways to do
      that.
    </font>

    <br />
    <br />

    {/* EMAIL */}
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
      <tbody>
        <tr>
          <td align="center" bgColor="#FFFF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              &#9993; EMAIL (PREFERRED) &#9993;
            </font>
          </td>
        </tr>
        <tr>
          <td align="center" bgColor="#000000">
            <br />
            <font face="Courier New" size="4" color="#00FF00">
              <a
                href="mailto:vestibule@sacor.xyz"
                className="yellow-link"
              >
                vestibule@sacor.xyz
              </a>
            </font>
            <br />
            <br />
            <font face="Comic Sans MS" size="2" color="#FFFFFF">
              The best way to reach me.
            </font>
            <br />
            <br />
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    {/* GITHUB */}
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
      <tbody>
        <tr>
          <td align="center" bgColor="#00FFFF" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              &lt;/&gt; GITHUB &lt;/&gt;
            </font>
          </td>
        </tr>
        <tr>
          <td align="center" bgColor="#000000">
            <br />
            <font face="Courier New" size="3" color="#FFFF00">
              <a
                href="https://github.com/sacor10"
                target="_blank"
                rel="noopener noreferrer"
                className="yellow-link"
              >
                github.com/sacor10
              </a>
            </font>
            <br />
            <br />
            <font face="Comic Sans MS" size="2" color="#FFFFFF">
              Open an issue, star a repo, judge my commit messages.
            </font>
            <br />
            <br />
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    {/* AIM / ICQ (JOKE) */}
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
      <tbody>
        <tr>
          <td align="center" bgColor="#FF00FF" className="section-bar-sm">
            <font face="Impact" size="4" color="#FFFF00">
              ~ INSTANT MESSAGE ME ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgColor="#000000">
            <br />
            <center>
              <font face="Courier New" size="3" color="#00FF00">
                <b className="yellow">AIM:</b> <s>sacor_k_rool_99</s>{' '}
                <font color="#FF6666">(discontinued 2017)</font>
                <br />
                <b className="yellow">ICQ:</b> <s>27489315</s>{' '}
                <font color="#FF6666">(RIP 2024)</font>
                <br />
                <b className="yellow">MSN:</b>{' '}
                <s>sacor@hotmail.com</s>{' '}
                <font color="#FF6666">(gone)</font>
                <br />
                <b className="yellow">Signal / iMessage:</b>{' '}
                <font color="#FFFFFF">ask via email</font>
              </font>
              <br />
              <font face="Comic Sans MS" size="2" color="#FFFF00">
                <i>What.</i>
              </font>
            </center>
            <br />
          </td>
        </tr>
      </tbody>
    </table>

    <br />
    <br />

    <center>
      <font face="Comic Sans MS" size="2" color="#00FFFF">
        &#9733; Don&rsquo;t forget to sign the <Link to="/guestbook">guestbook</Link> on your way
        out! &#9733;
      </font>
    </center>
  </>
)

export default function ContactPage() {
  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
