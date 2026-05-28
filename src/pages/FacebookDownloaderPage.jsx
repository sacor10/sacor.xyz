import { useState } from 'react'
import Layout from '../Layout'
import { downloadBlob, fetchVideoBlob, openPreviewWindow } from '../lib/download'

const API_ENDPOINT = '/.netlify/functions/facebook-download'
const DEFAULT_ERROR = 'No downloadable public Facebook video was found for that URL.'

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
                <b className="cyan">Reels:</b> facebook.com/reel/&lt;id&gt;
                <br />
                <b className="lime">Watch:</b> facebook.com/watch/?v=&lt;id&gt;
                <br />
                <b className="yellow">Posts:</b> facebook.com/&lt;page&gt;/videos/&lt;id&gt;
                <br />
                <b className="hotpink">Share:</b> facebook.com/share/r/&lt;id&gt; &amp; fb.watch/&lt;id&gt;
                <br />
                <br />
                Public videos only. Private, login-gated, and image-only posts will politely bounce.
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
                ~ HOW IT WORKS ~
              </font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#00FF00">
                Share links get resolved to their canonical reel or video, then the highest-quality
                MP4 comes straight down as one file. HD when Facebook offers it.
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
                Save stuff you own or have permission to download. Private or members-only content is out of scope.
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

export default function FacebookDownloaderPage() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [downloadLink, setDownloadLink] = useState(null)
  const [meta, setMeta] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    const targetUrl = url.trim()

    if (!targetUrl) {
      setStatus('error')
      setMessage('Paste a public Facebook video URL first.')
      return
    }

    const previewWindow = openPreviewWindow()
    setStatus('loading')
    setMessage('Finding the video...')
    setDownloadLink(null)
    setMeta(null)

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

      const video = videos[0]
      // Surface what the extractor found so the result is debuggable without
      // dev tools (e.g. on mobile) — especially the muxed/audio flag.
      setMeta({
        source: video.source || null,
        muxed: video.muxed !== false,
        width: video.width || null,
        height: video.height || null,
      })
      setMessage(`Downloading ${video.filename}...`)
      const blob = await fetchVideoBlob(video.proxyUrl || video.url)
      const objectUrl = downloadBlob(blob, video.filename, previewWindow)
      setStatus('success')
      setMessage(`Download started: ${video.filename}`)
      setDownloadLink(objectUrl ? { url: objectUrl, filename: video.filename } : null)
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
          <span className="blink">~*~ FACEBOOK VIDEO DOWNLOADER ~*~</span>
        </font>
      </center>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
        <tbody>
          <tr>
            <td>
              <font face="Comic Sans MS" size="3" color="#FFFFFF">
                Paste a public Facebook reel, watch, or video URL and this thing grabs the MP4 straight
                from Facebook's CDN. Share links (facebook.com/share/r/...) and fb.watch short links
                work too &mdash; they get resolved automatically.
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
                    FACEBOOK URL:
                  </font>
                  <input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://www.facebook.com/share/r/..."
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

              {meta && status === 'success' && (
                <>
                  <br />
                  <div className="igdl-status">
                    <font face="Courier New" size="2" color="#00FFFF">
                      DEBUG &mdash; source: <b className="yellow">{meta.source || 'unknown'}</b>
                      {meta.width && meta.height ? (
                        <> &nbsp;|&nbsp; size: <b className="yellow">{meta.width}&times;{meta.height}</b></>
                      ) : null}
                      {' '}|{' '}audio:{' '}
                      <b className={meta.muxed ? 'lime' : 'hotpink'}>
                        {meta.muxed ? 'YES (muxed)' : 'NO (video-only track)'}
                      </b>
                    </font>
                    {!meta.muxed && (
                      <>
                        <br />
                        <font face="Comic Sans MS" size="2" color="#FF66CC">
                          Heads up: Facebook only offered a separate (video-only) track for this one,
                          so the file has no sound. Tell Claude &ldquo;muxed: NO&rdquo; and which source
                          won &mdash; that means server-side audio+video merging is needed.
                        </font>
                      </>
                    )}
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
          Public Facebook media only &nbsp;&#9733;&nbsp;
          <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
        </font>
      </center>

      <br />
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={<Sidebar />} />
}
