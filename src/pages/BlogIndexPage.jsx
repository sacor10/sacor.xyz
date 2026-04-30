import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../Layout'

const FEED_COLORS = {
  'Cremieux Recueil': '#FF00FF',
  'TR Center':        '#00FFFF',
  'The New Outlook':  '#00FF00',
  'MTS Live':          '#FFFF00',
  'a16z News':         '#FF6600',
  'MacroEdge':         '#66FF66',
  'More in Common':   '#FF99CC',
  "Lenny's Newsletter": '#99CCFF',
  "That's Kaizen":    '#CC99FF',
}

const SUBSCRIPTIONS = [
  { name: 'Cremieux Recueil', url: 'https://cremieux.substack.com' },
  { name: 'TR Center', url: 'https://trcenter.substack.com' },
  { name: 'The New Outlook', url: 'https://thenewoutlook.substack.com' },
  { name: 'MTS Live', url: 'https://mtslive.substack.com' },
  { name: 'a16z News', url: 'https://www.a16z.news' },
  { name: 'MacroEdge', url: 'https://www.macroedge.world' },
  { name: 'More in Common', url: 'https://moreincommon.substack.com' },
  { name: "Lenny's Newsletter", url: 'https://www.lennysnewsletter.com' },
  { name: "That's Kaizen", url: 'https://thatskaizen.substack.com' },
]

function formatDate(pubDate) {
  const d = new Date(pubDate)
  return isNaN(d) ? pubDate : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function Thumbnail({ item }) {
  const color = FEED_COLORS[item.feedName] ?? '#FF00FF'
  if (item.image) {
    return (
      <img
        src={item.image}
        alt="thumb"
        width="80"
        height="80"
        border="3"
        style={{ borderStyle: 'ridge', borderColor: color, display: 'block', objectFit: 'cover' }}
      />
    )
  }
  const initials = item.feedName.split(' ').map(w => w[0]).join('').slice(0, 2)
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" style={{ display: 'block' }}>
      <rect width="80" height="80" fill={color} />
      <rect x="3" y="3" width="74" height="74" fill="none" stroke="#000000" strokeWidth="3" />
      <text x="40" y="46" fontFamily="Impact" fontSize="22" fill="#000000" textAnchor="middle">
        {initials}
      </text>
    </svg>
  )
}

const rightSidebar = (
  <>
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
      <tbody>
        <tr>
          <td align="center" bgColor="#FF00FF" className="section-bar-sm">
            <font face="Impact" size="4" color="#FFFF00">
              ~ NAVIGATION ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center">
            <font face="Comic Sans MS" size="2" color="#FFFFFF">
              Reading material curated by Sacor!!!
              <br />
              <br />
            </font>
            <Link to="/" className="navbtn-link">&#9733; BACK TO HOME &#9733;</Link>
          </td>
        </tr>
      </tbody>
    </table>

    <br />

    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgColor="#000000">
      <tbody>
        <tr>
          <td align="center" bgColor="#FF00FF" className="section-bar-sm">
            <font face="Impact" size="4" color="#FFFF00">
              ~ SUBSCRIPTIONS ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgColor="#000000">
            <font face="Comic Sans MS" size="2" color="#00FF00">
              Posts pulled live from these fine publications:
            </font>
            <br />
            <br />
            <font face="Comic Sans MS" size="2">
              <ul style={{ margin: 0, paddingLeft: '1.2em', color: '#FFFFFF' }}>
                {SUBSCRIPTIONS.map((subscription, index) => (
                  <li key={subscription.url} style={{ marginBottom: index === SUBSCRIPTIONS.length - 1 ? 0 : '6px' }}>
                    <a
                      href={subscription.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: FEED_COLORS[subscription.name] ?? '#FF00FF' }}
                    >
                      {subscription.name}
                    </a>
                  </li>
                ))}
              </ul>
            </font>
          </td>
        </tr>
      </tbody>
    </table>
  </>
)

const PAGE_SIZE = 5

export default function BlogIndexPage() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('loading')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    let cancelled = false
    fetch('/.netlify/functions/substack-feed')
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then(data => {
        if (cancelled) return
        setItems(Array.isArray(data) ? data : [])
        setStatus('ready')
      })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [])

  const mainContent = (
    <>
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

      {status === 'loading' && (
        <center>
          <font face="Impact" size="5" color="#00FFFF">
            <blink>~ FETCHING RAMBLINGS... ~</blink>
          </font>
        </center>
      )}

      {status === 'error' && (
        <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
          <tbody>
            <tr>
              <td align="center">
                <font face="Impact" size="5" color="#FF0000">
                  &#9888; FEED OFFLINE &#9888;
                </font>
                <br />
                <br />
                <font face="Comic Sans MS" size="3" color="#FFFF00">
                  The RSS tubes are clogged!!! Try refreshing.
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {status === 'ready' && items.slice(0, visibleCount).map(item => (
        <div key={item.link}>
          <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
            <tbody>
              <tr valign="top">
                <td width="90">
                  <Thumbnail item={item} />
                </td>
                <td>
                  <span className="posttitle">{item.title}</span>
                  <br />
                  <font face="Arial" size="2" color="#FFFF00">
                    {item.feedName} &middot; {formatDate(item.pubDate)}
                  </font>
                  <br />
                  <br />
                  <font face="Comic Sans MS" size="3" color="#FFFFFF">
                    {item.description}
                  </font>
                  <br />
                  <br />
                  <a href={item.link} target="_blank" rel="noopener noreferrer">
                    Read More &rarr;
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
          <br />
        </div>
      ))}

      {status === 'ready' && visibleCount < items.length && (
        <center>
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            style={{
              fontFamily: 'Impact',
              fontSize: '18px',
              color: '#FFFF00',
              background: '#000000',
              border: '4px outset #FF00FF',
              padding: '8px 24px',
              cursor: 'pointer',
              letterSpacing: '2px',
            }}
          >
            &#9660; LOAD MORE RAMBLINGS &#9660;
          </button>
        </center>
      )}
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
