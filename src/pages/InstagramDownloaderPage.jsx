import { useState } from 'react'
import JSZip from 'jszip'
import Layout from '../Layout'
import DownloadsNav from '../components/DownloadsNav'
import { downloadBlob, fetchVideoBlob, openPreviewWindow } from '../lib/download'

const NETLIFY_ENDPOINT = '/.netlify/functions/instagram-download'
const API_BASE = (import.meta.env.VITE_INSTAGRAM_DOWNLOADER_API_URL || '').replace(/\/+$/, '')

const DEFAULT_ERROR = 'No downloadable public videos were found for that URL.'

function zipBaseName(filename) {
  const trimmed = filename.replace(/\.mp4$/i, '').replace(/-\d+$/, '')
  return `${trimmed || 'instagram-videos'}-videos.zip`
}

function getDownloadFilename(disposition) {
  if (!disposition) return 'instagram-download.mp4'

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
  return plain?.[1]?.trim() || 'instagram-download.mp4'
}

async function readDownloadError(response) {
  const body = await response.json().catch(() => null)
  if (body?.message) return body.message
  if (body?.error) return body.error
  if (response.status === 404) return 'No downloadable public Instagram videos were found for that URL.'
  if (response.status === 400) return 'Invalid Instagram URL. Please provide a valid public Reel or post link.'
  if (response.status >= 500) return `Downloader server error (HTTP ${response.status}). Please try again later.`
  return `${DEFAULT_ERROR} (HTTP ${response.status})`
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
      let response = null
      let endpointUsed = NETLIFY_ENDPOINT

      // First attempt: try the Netlify Function endpoint
      try {
        response = await fetch(NETLIFY_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl }),
        })
      } catch (err) {
        console.warn(`[InstagramDownloader] ${NETLIFY_ENDPOINT} failed:`, err)
        // If Netlify function endpoint fails to connect (e.g. running vite standalone) and API_BASE is set
        if (API_BASE) {
          endpointUsed = `${API_BASE}/download`
          response = await fetch(endpointUsed, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl }),
          })
        } else {
          throw err
        }
      }

      // If Netlify function returned 404 (e.g. unhandled locally) and API_BASE is configured, try fallback
      if (response && response.status === 404 && API_BASE && endpointUsed !== `${API_BASE}/download`) {
        endpointUsed = `${API_BASE}/download`
        response = await fetch(endpointUsed, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl }),
        })
      }

      if (!response.ok) {
        const errText = await readDownloadError(response)
        console.error(`[InstagramDownloader] Server responded with error ${response.status} from ${endpointUsed}:`, errText)
        throw new Error(errText)
      }

      const contentType = response.headers.get('content-type') || ''

      // Handle JSON response (from Netlify function)
      if (contentType.includes('application/json')) {
        const data = await response.json()
        const videos = data.videos || []
        if (!Array.isArray(videos) || videos.length === 0) {
          throw new Error(DEFAULT_ERROR)
        }

        if (videos.length === 1) {
          setMessage(`Downloading ${videos[0].filename}...`)
          const blob = await fetchVideoBlob(videos[0].proxyUrl || videos[0].url)
          const objectUrl = downloadBlob(blob, videos[0].filename, previewWindow)
          setStatus('success')
          setMessage(`Download started: ${videos[0].filename}`)
          setDownloadLink(objectUrl ? { url: objectUrl, filename: videos[0].filename } : null)
          return
        }

        // Multiple videos: zip them client-side
        if (previewWindow && !previewWindow.closed) previewWindow.close()
        const zip = new JSZip()
        for (let i = 0; i < videos.length; i += 1) {
          setMessage(`Downloading ${i + 1} of ${videos.length}...`)
          const blob = await fetchVideoBlob(videos[i].proxyUrl || videos[i].url)
          zip.file(videos[i].filename, blob)
        }
        setMessage(`Packing ${videos.length} videos into a ZIP...`)
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const zipName = zipBaseName(videos[0].filename)
        const objectUrl = downloadBlob(zipBlob, zipName)
        setStatus('success')
        setMessage(`Download started: ${zipName}`)
        setDownloadLink(objectUrl ? { url: objectUrl, filename: zipName } : null)
        return
      }

      // Handle direct stream response (e.g. from Express binary stream)
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
      console.error('[InstagramDownloader] Download operation failed:', error)
      setStatus('error')

      const isNetworkError =
        error?.name === 'TypeError' &&
        (error?.message === 'Failed to fetch' || error?.message?.includes('fetch') || error?.message?.includes('NetworkError'))

      if (isNetworkError) {
        setMessage(
          `Unable to connect to the Instagram downloader service. Please check your network connection or verify that the service is running. (${error.message})`
        )
      } else {
        setMessage(error?.message || DEFAULT_ERROR)
      }
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
