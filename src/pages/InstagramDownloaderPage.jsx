import { useState } from 'react'
import Layout from '../Layout'
import DownloadsNav from '../components/DownloadsNav'
import { downloadBlob, openPreviewWindow } from '../lib/download'

const API_BASE = (import.meta.env.VITE_INSTAGRAM_DOWNLOADER_API_URL || 'http://localhost:8787')
  .replace(/\/+$/, '')

const DEFAULT_ERROR = 'No downloadable public videos were found for that URL.'

function getDownloadFilename(disposition) {
  if (!disposition) return 'instagram-download'

  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim())
    } catch {
      return utf8[1].trim()
    }
  }

  const quoted = disposition.match(/filename="([^"]+)"/i)
  if (quoted?.[1]) return quoted[1].trim()

  const plain = disposition.match(/filename=([^;]+)/i)
  return plain?.[1]?.trim() || 'instagram-download'
}

async function readDownloadError(response) {
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
                <b className="cyan">Reels:</b> /reel/ links
                <br />
                <b className="lime">Posts:</b> /p/ links
                <br />
                <b className="yellow">Videos:</b> /tv/ links
                <br />
                <br />
                Public Instagram videos only. Photo-only posts will politely bounce.
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
                Carousel posts download as one ZIP with up to 20 public videos inside.
                Single videos download as one MP4.
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

export default function InstagramDownloaderPage() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [downloadLink, setDownloadLink] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    const targetUrl = url.trim()

    if (!targetUrl) {
      setStatus('error')
      setMessage('Paste a public Instagram Reel or video post URL first.')
      return
    }

    const previewWindow = openPreviewWindow()
    setStatus('loading')
    setMessage('Finding public videos and preparing your download...')
    setDownloadLink(null)

    try {
      const response = await fetch(`${API_BASE}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      })

      if (!response.ok) {
        throw new Error(await readDownloadError(response))
      }

      const filename = getDownloadFilename(response.headers.get('Content-Disposition'))
      const blob = await response.blob()
      const isZip = /\.zip$/i.test(filename) || blob.type === 'application/zip'
      if (isZip && previewWindow && !previewWindow.closed) previewWindow.close()
      const objectUrl = downloadBlob(blob, filename, isZip ? null : previewWindow)
      setStatus('success')
      setMessage(`Download started: ${filename}`)
      setDownloadLink(objectUrl ? { url: objectUrl, filename } : null)
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
          <span className="blink">~*~ INSTAGRAM LINK DOWNLOADER ~*~</span>
        </font>
      </center>

      <br />

      <DownloadsNav />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
        <tbody>
          <tr>
            <td>
              <font face="Comic Sans MS" size="3" color="#FFFFFF">
                Paste a public Instagram Reel or video post URL and this thing grabs every public video it can find
                in one shot. Reels come down as MP4; multi-video posts come down as one ZIP.
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
                    INSTAGRAM URL:
                  </font>
                  <input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://www.instagram.com/reel/..."
                    disabled={status === 'loading'}
                  />
                </label>

                <center>
                  <button type="submit" className="igdl-submit" disabled={status === 'loading'}>
                    {status === 'loading' ? '~ WORKING ~' : <>&#11015; DOWNLOAD VIDEOS &#11015;</>}
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
          Powered by yt-dlp &nbsp;&#9733;&nbsp; Public Instagram media only &nbsp;&#9733;&nbsp;
          <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
        </font>
      </center>

      <br />
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={<Sidebar />} />
}
