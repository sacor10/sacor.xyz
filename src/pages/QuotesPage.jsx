import { Link } from 'react-router-dom'
import Layout from '../Layout'
import { olderQuotes, pinnedQuotes, quotes } from '../data/quotes'

function QuoteMeta({ quote }) {
  const bits = [quote.speaker, quote.date, quote.source].filter(Boolean)
  if (bits.length === 0) return null

  return (
    <font face="Courier New" size="2" color="#FFFF00">
      {bits.map((bit, index) => (
        <span key={`${quote.id}-${bit}`}>
          {index > 0 && <> &nbsp;&bull;&nbsp; </>}
          {bit}
        </span>
      ))}
    </font>
  )
}

function QuoteTags({ quote }) {
  if (!quote.tags?.length) return null

  return (
    <>
      <br />
      <br />
      <font face="Courier New" size="2" color="#00FF00">
        {quote.tags.map((tag) => (
          <span key={tag}>[{tag}] </span>
        ))}
      </font>
    </>
  )
}

function QuoteCard({ quote, featured = false }) {
  return (
    <table
      width="100%"
      cellPadding="10"
      cellSpacing="0"
      border="0"
      className="postbox"
      style={{ borderLeft: `6px solid ${featured ? '#FFFF00' : '#00FFFF'}` }}
    >
      <tbody>
        <tr valign="top">
          <td>
            <font face="Impact" size="4" color={featured ? '#FFFF00' : '#00FFFF'}>
              {featured ? '~ PINNED QUOTE ~' : '~ ARCHIVE QUOTE ~'}
            </font>
            <br />
            <QuoteMeta quote={quote} />
            <br />
            <br />
            <font face="Comic Sans MS" size="4" color="#FFFFFF">
              <span style={{ display: 'block', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                &quot;{quote.text}&quot;
              </span>
            </font>
            {quote.context && (
              <>
                <br />
                <br />
                <font face="Comic Sans MS" size="2" color="#CCCCCC">
                  <i>{quote.context}</i>
                </font>
              </>
            )}
            <QuoteTags quote={quote} />
            {quote.link && (
              <>
                <br />
                <br />
                <font face="Comic Sans MS" size="2">
                  <a href={quote.link} target="_blank" rel="noopener noreferrer">
                    Source Link &rarr;
                  </a>
                </font>
              </>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function QuoteList({ items, featured = false, emptyText }) {
  if (items.length === 0) {
    return (
      <table width="100%" cellPadding="10" cellSpacing="0" border="0" className="postbox">
        <tbody>
          <tr>
            <td align="center">
              <font face="Comic Sans MS" size="3" color="#FFFF00">
                <span className="blink">{emptyText}</span>
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    )
  }

  return items.map((quote) => (
    <div key={quote.id}>
      <QuoteCard quote={quote} featured={featured} />
      <br />
    </div>
  ))
}

const allTags = Array.from(new Set(quotes.flatMap((quote) => quote.tags || [])))

const rightSidebar = (
  <>
    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
      <tbody>
        <tr>
          <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
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

    <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
      <tbody>
        <tr>
          <td align="center" bgcolor="#00FFFF" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ QUOTE STATS ~
            </font>
          </td>
        </tr>
        <tr>
          <td align="center" bgcolor="#000000">
            <font face="Courier New" size="2" color="#00FF00">
              <b className="yellow">Total quotes:</b> {quotes.length}
              <br />
              <b className="yellow">Pinned:</b> {pinnedQuotes.length}
              <br />
              <b className="yellow">Older catalog:</b> {olderQuotes.length}
            </font>
          </td>
        </tr>
      </tbody>
    </table>

    {allTags.length > 0 && (
      <>
        <br />
        <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#4B0082">
          <tbody>
            <tr>
              <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
                <font face="Impact" size="4" color="#000000">
                  ~ TAGS ~
                </font>
              </td>
            </tr>
            <tr>
              <td bgcolor="#000000">
                <font face="Courier New" size="2" color="#00FFFF">
                  {allTags.map((tag) => (
                    <span key={tag}>[{tag}] </span>
                  ))}
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </>
    )}
  </>
)

const mainContent = (
  <>
    <center>
      <font face="Impact" size="6" color="#00FFFF" className="hero-glow">
        <span className="blink">~*~ QUOTES FROM OTHERS ~*~</span>
      </font>
      <br />
      <font face="Comic Sans MS" size="3" color="#FFFF00">
        Messages and sentences that refused to leave the premises.
      </font>
    </center>

    <br />

    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FF00FF" className="section-bar">
              <font face="Impact" size="5" color="#FFFF00">
                <span className="blink">~ PINNED ~</span>
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </center>

    <br />

    <QuoteList items={pinnedQuotes} featured emptyText="NO PINNED QUOTES YET!!!" />

    <center>
      <table width="100%" cellPadding="0" cellSpacing="0" border="0">
        <tbody>
          <tr>
            <td align="center" bgcolor="#00FFFF" className="section-bar">
              <font face="Impact" size="5" color="#000000">
                ~ OLDER QUOTE CATALOG ~
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </center>

    <br />

    <QuoteList items={olderQuotes} emptyText="NO OLDER QUOTES HAVE ESCAPED INTO THE ARCHIVE YET!!!" />
  </>
)

export default function QuotesPage() {
  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
