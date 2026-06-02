import Layout from '../Layout'

const rightSidebar = (
  <>
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
      <tbody>
        <tr>
          <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
            <font face="Impact" size="4" color="#FFFF00">
              ~ DID YOU KNOW? ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center" bgcolor="#000000">
            <br />
            <font face="Comic Sans MS" size="2" color="#00FF00">
              The Earth experiences over{' '}
              <b className="yellow">500,000 earthquakes</b> per year — about 1,400 per day!
            </font>
            <br />
            <br />
            <font face="Comic Sans MS" size="2" color="#FFFFFF">
              Most are too small to feel, but the USGS tracks every single one.
            </font>
            <br />
            <br />
          </td>
        </tr>
      </tbody>
    </table>
    <br />
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
      <tbody>
        <tr>
          <td align="center" bgcolor="#00FFFF" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ RICHTER SCALE ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgcolor="#000000">
            <br />
            <font face="Courier New" size="2" color="#FFFF00">
              <b className="cyan">M 1-2:</b> Barely felt <br />
              <b className="cyan">M 3-4:</b> Minor shaking <br />
              <b className="cyan">M 5-6:</b> Moderate damage <br />
              <b className="cyan">M 7+:</b> Major earthquake <br />
              <b className="cyan">M 9+:</b>{' '}
              <font color="#FF00FF">MEGA quake!!</font>
            </font>
            <br />
            <br />
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
        ☺ HELLO EASTON! ☺
      </font>
      <br />
      <font face="Comic Sans MS" size="3" color="#FFFF00">
        <span className="blink">~ Welcome to your very own page! ~</span>
      </font>
    </center>
    <br />

    {/* Baseball Bat Showcase Container */}
    <center>
      <div style={{ 
        border: '4px outset #FF00FF', 
        padding: '15px', 
        background: '#000000', 
        maxWidth: '500px',
        marginBottom: '20px'
      }}>
        <img 
          src="/speed.png" 
          alt="Easton Speed Baseball Bat" 
          style={{ 
            width: '100%', 
            height: 'auto', 
            display: 'block',
            border: '2px solid #00FFFF',
            background: '#FFFFFF'
          }} 
        />
        <br />
        <font face="Impact" size="4" color="#00FFFF">
          🔥 <b>EASTON SPEED POWER!</b> 🔥
        </font>
      </div>
    </center>

    <font face="Comic Sans MS" size="3" color="#FFFFFF">
      Hey Easton! This page was made{' '}
      <b className="hotpink">just for you</b>. You are awesome and the internet has now been officially notified. Check out the cool earthquake stuff below!
    </font>
    <br />
    <br />
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
      <tbody>
        <tr>
          <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
            <font face="Impact" size="4" color="#FFFF00">
              📈 EARTHQUAKE CENTRAL 📈
            </font>
          </td>
        </tr>
        <tr>
          <td align="center" bgcolor="#000000">
            <br />
            <font face="Comic Sans MS" size="3" color="#FFFFFF">
              The <b className="cyan">U.S. Geological Survey</b> tracks every earthquake happening on Earth — right now!
            </font>
            <br />
            <br />
            <font face="Courier New" size="4" color="#00FF00">
              <a href="https://usgs.gov" target="_blank" rel="noopener noreferrer" className="yellow-link" >
                earthquake.usgs.gov
              </a>
            </font>
            <br />
            <br />
            <font face="Comic Sans MS" size="2" color="#FFFF00">
              Click the link above to see live earthquake maps, recent quake lists, and tons of science. The ground is always moving somewhere!
            </font>
            <br />
            <br />
          </td>
        </tr>
      </tbody>
    </table>
    <br />
    <br />
    <center>
      <font face="Comic Sans MS" size="2" color="#00FFFF">
        ★ Stay curious, Easton! ★
      </font>
    </center>
  </>
)

export default function EastonPage() {
  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}