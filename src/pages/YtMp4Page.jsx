import Layout from '../Layout'
import DownloadsNav from '../components/DownloadsNav'

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
              You found my download page!!!
              <br />
              <br />
            </font>
            <a href="/" className="navbtn-link">&#9733; BACK TO HOME &#9733;</a>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    {/* SYSTEM REQUIREMENTS */}
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
      <tbody>
        <tr>
          <td align="center" bgcolor="#00FFFF" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ REQUIREMENTS ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgcolor="#000000">
            <font face="Comic Sans MS" size="2" color="#00FF00">
              <b className="yellow">OS:</b> Windows 10/11
              <br />
              <b className="yellow">Arch:</b> x64 only
              <br />
              <b className="yellow">.NET:</b> not needed!!!
              <br />
              <b className="yellow">Size:</b> ~350 MB zip
              <br />
              <br />
              <font color="#FFFF00">No install needed!!!<br />Just extract &amp; run!!!</font>
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    {/* MORE COMING SOON */}
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#4B0082">
      <tbody>
        <tr>
          <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ MORE APPS ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center" bgcolor="#000000">
            <font face="Comic Sans MS" size="2" color="#00FFFF">
              More free Windows apps coming soon!!!
              <br />
              <br />
              <span className="blink">
                <font color="#FF00FF">WATCH THIS SPACE!!!</font>
              </span>
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
        <span className="blink">FREE DOWNLOAD!!!</span>
      </font>
    </center>

    <br />

    <DownloadsNav />

    {/* TITLE SECTION BAR */}
    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FF00FF" className="section-bar">
              <font face="Impact" size="5" color="#FFFF00">
                ~*~ YtMp4 - YouTube to MP4 Downloader ~*~
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </center>

    <br />

    {/* DESCRIPTION */}
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
      <tbody>
        <tr>
          <td>
            <font face="Comic Sans MS" size="3" color="#FFFFFF">
              OK so I built this thing because I was SICK of sketchy websites trying to
              convert YouTube videos with a billion popup ads!!! This is a{' '}
              <b className="lime">real Windows app</b> that runs on your computer, grabs
              the <b className="yellow">best quality video + audio</b>, smashes them together
              with FFmpeg, and spits out a clean MP4 with{' '}
              <b className="hotpink">pristine original audio</b> — no re-encoding, no clipping!!!
              <br />
              <br />
              It&rsquo;s powered under the hood by{' '}
              <b className="cyan">yt-dlp</b> and <b className="cyan">ffmpeg</b> — both
              bundled in the zip so you don&rsquo;t have to install ANYTHING!!! Just
              extract and double-click!!!
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    {/* FEATURES */}
    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgcolor="#00FFFF" className="section-bar">
              <font face="Impact" size="4" color="#000000">
                ~ FEATURES ~
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </center>

    <br />

    <table width="100%" cellPadding="6" cellSpacing="4" border="0">
      <tbody>
        {[
          ['#FF00FF', 'Best available quality video + audio, merged into one MP4'],
          ['#00FF00', '16 parallel download fragments = BLAZING FAST speeds!!!'],
          ['#FFFF00', 'Original audio preserved bit-for-bit — zero quality loss!!!'],
          ['#00FFFF', 'Real-time progress bar with live download speed readout'],
          ['#FF00FF', 'Cancel anytime without leaving junk files behind'],
          ['#00FF00', 'No .NET runtime needed — fully self-contained!!!'],
          ['#FFFF00', 'Open the file or folder when done with one click!!!'],
        ].map(([color, text], i) => (
          <tr key={i}>
            <td width="30" align="center">
              <font face="Impact" size="4" color={color}>&#9733;</font>
            </td>
            <td bgcolor="#000000" className="feature-row">
              <font face="Comic Sans MS" size="3" color="#FFFFFF">{text}</font>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <br />

    {/* DOWNLOAD BUTTON */}
    <center>
      <table cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td className="dl-btn-wrap">
              {/* UPDATE THIS HREF when you upload the zip */}
              <a href="https://github.com/sacor10/ytmp4/releases/latest/download/ytmp4.zip" className="dl-btn" download>
                &#11015; DOWNLOAD YTMP4 v1.2 &#11015;
              </a>
            </td>
          </tr>
        </tbody>
      </table>
      <br />
      <font face="Comic Sans MS" size="2" color="#FFFF00">
        ~350 MB zip &nbsp;&#9733;&nbsp; Windows 10/11 x64 &nbsp;&#9733;&nbsp; 100% FREE!!!
      </font>
    </center>

    <br />
    <br />

    {/* HOW TO USE */}
    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FFFF00" className="section-bar">
              <font face="Impact" size="4" color="#000000">
                ~ HOW TO USE IT ~
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
              {[
                'Click the DOWNLOAD button above',
                'Extract the ZIP to any folder you like',
                'Double-click YtMp4.exe to launch',
                'Paste a YouTube URL into the box',
                'Pick a folder to save your MP4',
                'Click Download and watch the magic happen!!!',
                'Profit!!!',
              ].map((step, i) => (
                <span key={i}>
                  <font color="#FFFF00">
                    <b>{i + 1}.</b>
                  </font>{' '}
                  {step}
                  <br />
                </span>
              ))}
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    <center>
      <font face="Comic Sans MS" size="2" color="#888888">
        Built with C# / WPF / .NET 9 &nbsp;&#9733;&nbsp; Powered by yt-dlp &amp; FFmpeg
        &nbsp;&#9733;&nbsp; <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
      </font>
    </center>

    <br />
  </>
)

export default function YtMp4Page() {
  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
