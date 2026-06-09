import { useState } from 'react'
import Layout from '../Layout'
import DownloadsNav from '../components/DownloadsNav'
import { downloadBlob, fetchVideoBlob, openPreviewWindow } from '../lib/download'

const API_ENDPOINT = '/.netlify/functions/tiktok-download'
const DEFAULT_ERROR = 'No downloadable public TikTok video was found for that URL.'

async function readJsonError(response) {
  const body = await response.json().catch(() => null)
  return body?.message || body?.error || DEFAULT_ERROR
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
                <b className="cyan">Canonical:</b> tiktok.com/@user/video/&lt;id&gt;
                <br />
                <b className="lime">Short links:</b> vm.tiktok.com/&lt;code&gt;
                <br />
                <b className="yellow">Short links:</b> tiktok.com/t/&lt;code&gt;
                <br />
                <br />
                Public videos only. Slideshows will politely bounce.
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
                ~ NO WATERMARK ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#00FF00">
                Downloads the clean source MP4 without the TikTok watermark burned in.
                Some creator-restricted posts may still include it — rare but possible.
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
                Save stuff you own or have permission to download. Private or login-only posts are out of scope.
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

export default function TikTokDownloaderPage() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [downloadLink, setDownloadLink] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    const targetUrl = url.trim()

    if (!targetUrl) {
      setStatus('error')
      setMessage('Paste a public TikTok video URL first.')
      return
    }

    const previewWindow = openPreviewWindow()
    setStatus('loading')
    setMessage('Finding public video...')
    setDownloadLink(null)

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

      setMessage(`Downloading ${videos[0].filename}...`)
      const blob = await fetchVideoBlob(videos[0].proxyUrl || videos[0].url)
      const objectUrl = downloadBlob(blob, videos[0].filename, previewWindow)
      setStatus('success')
      setMessage(`Download started: ${videos[0].filename}`)
      setDownloadLink(objectUrl ? { url: objectUrl, filename: videos[0].filename } : null)
    } catch (error) {
      if (previewWindow && !previewWindow.closed) previewWindow.close()
      setStatus('error')
      setMessage(error?.message || DEFAULT_ERROR)
    }
  }

  const mainContent = (
    <>
      <center>
        <font face="Impact" size="6" color="#FF00FF" className="hero-glow">
          <span className="blink">~*~ TIKTOK VIDEO DOWNLOADER ~*~</span>
        </font>
      </center>

      <br />

      <DownloadsNav />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
        <tbody>
          <tr>
            <td>
              <font face="Comic Sans MS" size="3" color="#FFFFFF">
                Paste a public TikTok video URL and this thing grabs the no-watermark MP4.
                Short links and canonical URLs both work.
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
                    TIKTOK URL:
                  </font>
                  <input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://www.tiktok.com/@user/video/..."
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
                      {status === 'success' && downloadLink ? (
                        <>
                          Download started:{' '}
                          <a href={downloadLink.url} download={downloadLink.filename} className="igdl-download-link">
                            {downloadLink.filename}
                          </a>
                        </>
                      ) : message}
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
          Public TikTok videos only &nbsp;&#9733;&nbsp;
          <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
        </font>
      </center>

      <br />
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={<Sidebar />} />
}
