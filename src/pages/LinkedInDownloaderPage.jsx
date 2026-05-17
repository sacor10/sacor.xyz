import { useState } from 'react'
import JSZip from 'jszip'
import Layout from '../Layout'
import { downloadBlob, fetchVideoBlob } from '../lib/download'

const API_ENDPOINT = '/.netlify/functions/linkedin-download'
const DEFAULT_ERROR = 'No downloadable public LinkedIn video was found for that URL.'

async function readJsonError(response) {
  const body = await response.json().catch(() => null)
  return body?.message || body?.error || DEFAULT_ERROR
}

function zipBaseName(filename) {
  const trimmed = filename.replace(/\.mp4$/i, '').replace(/-\d+$/, '')
  return `${trimmed || 'linkedin-videos'}-videos.zip`
}

function Sidebar() {
  return (
    <>
      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
              <font face="Impact" size="4" color="#FFFF00">
                ~ VALID TARGETS ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#FFFFFF">
                <b className="cyan">Posts:</b> linkedin.com/posts/&lt;author&gt;_...
                <br />
                <b className="lime">Feed:</b> linkedin.com/feed/update/urn:li:...
                <br />
                <b className="yellow">URN:</b> ugcPost-&lt;id&gt; and activity-&lt;id&gt;
                <br />
                <br />
                Public post videos only. Articles, polls, and image-only posts will politely bounce.
              </font>
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
                ~ BATCH MODE ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#00FF00">
                Single videos download as one MP4. Posts with multiple public videos come down as one ZIP.
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#4B0082">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">
                ~ BE COOL ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#FFFFFF">
                Save stuff you own or have permission to download. Private or member-only posts are out of scope.
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

export default function LinkedInDownloaderPage() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    const targetUrl = url.trim()

    if (!targetUrl) {
      setStatus('error')
      setMessage('Paste a public LinkedIn post URL first.')
      return
    }

    setStatus('loading')
    setMessage('Finding public videos...')

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      })

      if (!response.ok) {
        throw new Error(await readJsonError(response))
      }

      const { videos } = await response.json()
      if (!Array.isArray(videos) || videos.length === 0) {
        throw new Error(DEFAULT_ERROR)
      }

      if (videos.length === 1) {
        setMessage(`Downloading ${videos[0].filename}...`)
        const blob = await fetchVideoBlob(videos[0].proxyUrl || videos[0].url)
        downloadBlob(blob, videos[0].filename)
        setStatus('success')
        setMessage(`Download started: ${videos[0].filename}`)
        return
      }

      const zip = new JSZip()
      for (let i = 0; i < videos.length; i += 1) {
        setMessage(`Downloading ${i + 1} of ${videos.length}...`)
        const blob = await fetchVideoBlob(videos[i].proxyUrl || videos[i].url)
        zip.file(videos[i].filename, blob)
      }
      setMessage(`Packing ${videos.length} videos into a ZIP...`)
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipName = zipBaseName(videos[0].filename)
      downloadBlob(zipBlob, zipName)
      setStatus('success')
      setMessage(`Download started: ${zipName}`)
    } catch (error) {
      setStatus('error')
      setMessage(error?.message || DEFAULT_ERROR)
    }
  }

  const mainContent = (
    <>
      <center>
        <font face="Impact" size="6" color="#FF00FF" className="hero-glow">
          <span className="blink">~*~ LINKEDIN VIDEO DOWNLOADER ~*~</span>
        </font>
      </center>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
        <tbody>
          <tr>
            <td>
              <font face="Comic Sans MS" size="3" color="#FFFFFF">
                Paste a public LinkedIn post URL and this thing grabs the MP4 straight from
                LinkedIn's embed player. Works on /posts/ links and /feed/update/ links alike.
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td align="center" bgcolor="#00FFFF" className="section-bar">
                <font face="Impact" size="5" color="#000000">
                  ~ DOWNLOAD TARGET ~
                </font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      <table width="100%" cellPadding="10" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
        <tbody>
          <tr>
            <td bgcolor="#000000">
              <form className="igdl-form" onSubmit={submit}>
                <label>
                  <font face="Courier New" size="3" color="#00FF00">
                    LINKEDIN URL:
                  </font>
                  <input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://www.linkedin.com/posts/..."
                    disabled={status === 'loading'}
                  />
                </label>

                <center>
                  <button type="submit" className="igdl-submit" disabled={status === 'loading'}>
                    {status === 'loading' ? '~ WORKING ~' : <>&#11015; DOWNLOAD VIDEO &#11015;</>}
                  </button>
                </center>
              </form>

              {message && (
                <>
                  <br />
                  <div className={`igdl-status igdl-status-${status}`}>
                    <font face="Comic Sans MS" size="3" color={status === 'error' ? '#FF0000' : '#FFFF00'}>
                      {message}
                    </font>
                  </div>
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <center>
        <font face="Comic Sans MS" size="2" color="#888888">
          Public LinkedIn media only &nbsp;&#9733;&nbsp;
          <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
        </font>
      </center>

      <br />
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={<Sidebar />} />
}
