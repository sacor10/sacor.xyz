import { Link } from 'react-router-dom'
import Layout from '../Layout'
import { posts, getPostHref } from '../data/posts'

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
              All my ramblings in one place!!!
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
          <td align="center" bgColor="#00FFFF" className="section-bar-sm">
            <font face="Impact" size="4" color="#000000">
              ~ THE ARCHIVE ~
            </font>
          </td>
        </tr>
        <tr>
          <td bgColor="#000000">
            <font face="Comic Sans MS" size="2" color="#00FF00">
              The complete <b className="yellow">Slop Blog</b> archive &mdash; every <b className="hotpink">rambling</b>,
              every <b className="cyan">half-baked thought</b>, every confession.
              <br />
              <br />
              Pour a salami lid. Settle in.
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

    {posts.map((post) => {
      const href = getPostHref(post)
      return (
        <div key={post.slug}>
          <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
            <tbody>
              <tr valign="top">
                <td width="90">
                  <img
                    src={post.thumb}
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
                  <Link to={href}>Read More &rarr;</Link>
                </td>
              </tr>
            </tbody>
          </table>
          <br />
        </div>
      )
    })}
  </>
)

export default function BlogIndexPage() {
  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
