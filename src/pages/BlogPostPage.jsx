import { Link, useParams } from 'react-router-dom'
import Layout from '../Layout'
import { posts, getPostBySlug, getPostHref } from '../data/posts'

function NotFound() {
  const mainContent = (
    <center>
      <br />
      <font face="Impact" size="7" color="#FF0000" className="hero-glow">
        <span className="blink">404!!!</span>
      </font>
      <br />
      <br />
      <font face="Comic Sans MS" size="4" color="#FFFF00">
        That blog post does not exist (yet?).
      </font>
      <br />
      <br />
      <Link to="/" className="navbtn-link">&#9733; BACK TO HOME &#9733;</Link>
      <br />
      <br />
    </center>
  )
  return <Layout mainContent={mainContent} rightSidebar={null} />
}

export default function BlogPostPage() {
  const { slug } = useParams()
  const post = getPostBySlug(slug)

  if (!post || post.link) {
    return <NotFound />
  }

  const otherPosts = posts.filter((p) => p.slug !== slug)

  const rightSidebar = (
    <>
      {/* NAV */}
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
              <Link to="/#blog-posts" className="navbtn-link">&#9733; ALL POSTS &#9733;</Link>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      {/* OTHER POSTS */}
      <table
        width="100%"
        cellPadding="8"
        cellSpacing="0"
        border="0"
        className="bevelbox"
        bgcolor="#000080"
      >
        <tbody>
          <tr>
            <td align="center" bgcolor="#00FFFF" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">
                ~ OTHER POSTS ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#FFFFFF">
              <font face="Times New Roman" size="3" color="#000000">
                <ul className="favlinks">
                  {otherPosts.map((p) =>
                    p.link ? (
                      <li key={p.slug}>
                        <Link to={p.link}>{p.title}</Link>
                      </li>
                    ) : (
                      <li key={p.slug}>
                        <Link to={getPostHref(p)}>{p.title}</Link>
                      </li>
                    ),
                  )}
                </ul>
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
              <td align="center" bgcolor="#FF00FF" className="section-bar">
                <font face="Impact" size="5" color="#FFFF00">
                  <span className="blink">~*~ BLOG POST ~*~</span>
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

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
                <i>{post.excerpt}</i>
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <div className="postbody">{post.body}</div>

      <br />
      <br />

      <center>
        <font face="Comic Sans MS" size="2" color="#00FFFF">
          &#9733; End of post. Thanks for scrolling. &#9733;
        </font>
        <br />
        <br />
        <Link to="/" className="navbtn-link">&#9733; BACK TO HOME &#9733;</Link>
      </center>
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={rightSidebar} />
}
