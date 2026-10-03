import { useState } from 'react'
import Layout from '../Layout'
import DownloadsNav from '../components/DownloadsNav'
import { downloadBlob, fetchVideoBlob, openPreviewWindow } from '../lib/download'
import { useAuth } from '../auth/useAuth'
import GoogleSignInButton from '../auth/GoogleSignInButton'

const SELF_HOSTED_API = (import.meta.env.VITE_YOUTUBE_DOWNLOADER_API_URL || 'http://127.0.0.1:5003').replace(/\/+$/, '')
const API_ENDPOINT = '/.netlify/functions/youtube-download'
const RESOLVE_ENDPOINT = '/.netlify/functions/youtube-resolve'
const DEFAULT_ERROR = 'No downloadable YouTube video or formats were found for that URL.'

async function readJsonError(response) {
  const body = await response.json().catch(() => null)
  return body?.message || body?.error || DEFAULT_ERROR
}

function RightSidebar({ activeTab }) {
  return (
    <>
      {/* BACK TO HOME */}
      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
              <font face="Impact" size="4" color="#FFFF00">
                ~ NAVIGATION ~
              </font>
            </td>
          </tr>
          <tr>
            <td align="center">
              <font face="Comic Sans MS" size="2" color="#FFFFFF">
                You found my download page!!!
                <br />
                <br />
              </font>
              <a href="/" className="navbtn-link">&#9733; BACK TO HOME &#9733;</a>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      {activeTab === 'web' ? (
        <>
          {/* WEB DOWNLOADER INFO */}
          <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
            <tbody>
              <tr>
                <td align="center" bgcolor="#00FFFF" className="section-bar-sm">
                  <font face="Impact" size="4" color="#000000">
                    ~ 4K ONLINE STREAM ~
                  </font>
                </td>
              </tr>
              <tr>
                <td bgcolor="#000000">
                  <font face="Comic Sans MS" size="2" color="#00FF00">
                    <b className="yellow">Quality:</b> Up to 4K (2160p) &amp; 1440p
                    <br />
                    <b className="yellow">Remuxing:</b> In-browser FFmpeg.wasm
                    <br />
                    <b className="yellow">Sound:</b> Pristine separate audio track merged losslessly
                    <br />
                    <br />
                    <font color="#FFFF00">Requires a quick Google Sign-in to protect bandwidth!</font>
                  </font>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        <>
          {/* SYSTEM REQUIREMENTS FOR DESKTOP APP */}
          <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
            <tbody>
              <tr>
                <td align="center" bgcolor="#00FFFF" className="section-bar-sm">
                  <font face="Impact" size="4" color="#000000">
                    ~ REQUIREMENTS ~
                  </font>
                </td>
              </tr>
              <tr>
                <td bgcolor="#000000">
                  <font face="Comic Sans MS" size="2" color="#00FF00">
                    <b className="yellow">OS:</b> Windows 10/11
                    <br />
                    <b className="yellow">Arch:</b> x64 only
                    <br />
                    <b className="yellow">.NET:</b> not needed!!!
                    <br />
                    <b className="yellow">Size:</b> ~350 MB zip
                    <br />
                    <br />
                    <font color="#FFFF00">No install needed!!!<br />Just extract &amp; run!!!</font>
                  </font>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      <br />

      {/* MORE COMING SOON */}
      <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="bevelbox" bgcolor="#4B0082">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">
                ~ MORE APPS ~
              </font>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#00FFFF">
                More free Windows apps coming soon!!!
                <br />
                <br />
                <span className="blink">
                  <font color="#FF00FF">WATCH THIS SPACE!!!</font>
                </span>
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

export default function YtMp4Page() {
  const { user, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('web') // 'web' or 'desktop'

  // Web Downloader State
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [videoInfo, setVideoInfo] = useState(null)
  const [selectedQuality, setSelectedQuality] = useState('')
  const [downloadLink, setDownloadLink] = useState(null)

  // Step 1: Query YouTube video metadata and formats
  const handleInspect = async (event) => {
    event.preventDefault()
    const targetUrl = url.trim()

    if (!targetUrl) {
      setStatus('error')
      setMessage('Paste a valid YouTube URL first.')
      return
    }

    setStatus('loading')
    setMessage('Analyzing YouTube video and available qualities...')
    setDownloadLink(null)
    setVideoInfo(null)

    try {
      let data = null

      // Primary: self-hosted API (local yt-dlp)
      try {
        const selfHostedRes = await fetch(`${SELF_HOSTED_API}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl }),
        })
        if (selfHostedRes.ok) {
          data = await selfHostedRes.json()
        }
      } catch (selfHostedErr) {
        console.warn('Self-hosted inspect endpoint unreachable, falling back to serverless function:', selfHostedErr)
      }

      // Fallback: serverless function
      if (!data || !data.qualities || data.qualities.length === 0) {
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl }),
        })

        if (!response.ok) {
          throw new Error(await readJsonError(response))
        }

        data = await response.json()
      }

      if (!data.qualities || data.qualities.length === 0) {
        throw new Error(DEFAULT_ERROR)
      }

      setVideoInfo(data)
      // Default to highest available quality
      setSelectedQuality(String(data.qualities[0].height))
      setStatus('idle')
      setMessage(`Found: "${data.title}" (${data.qualities.length} resolutions available)`)
    } catch (error) {
      setStatus('error')
      setMessage(error?.message || DEFAULT_ERROR)
    }
  }

  // Step 2: Download the chosen quality (resolves pre-muxed 4K/HD stream or falls back to in-browser mux)
  const handleDownload = async () => {
    if (!videoInfo) return

    const quality = videoInfo.qualities.find((q) => String(q.height) === String(selectedQuality)) || videoInfo.qualities[0]
    const previewWindow = openPreviewWindow()

    setStatus('loading')
    setDownloadLink(null)

    try {
      const outName = `${videoInfo.safeFilename}-${quality.height}p.mp4`

      // Primary: Self-hosted local downloader (pure native yt-dlp + ffmpeg)
      try {
        setMessage(`Starting direct self-hosted download for ${outName}...`)
        const selfStreamUrl = `${SELF_HOSTED_API}/stream?url=${encodeURIComponent(url)}&height=${quality.height}&title=${encodeURIComponent(videoInfo.safeFilename)}`
        
        // Trigger native browser download directly via anchor
        const a = document.createElement('a')
        a.href = selfStreamUrl
        a.download = outName
        document.body.appendChild(a)
        a.click()
        a.remove()

        setStatus('success')
        setMessage(`Download started: ${outName}`)
        setDownloadLink({ url: selfStreamUrl, filename: outName })
        return
      } catch (selfHostedErr) {
        console.warn('Self-hosted stream endpoint not reachable, trying alternative resolver:', selfHostedErr)
      }

      // Secondary: High-speed stream resolver
      setMessage(`Preparing ${quality.label} native stream... please wait 5-15 seconds...`)

      const mapHeightToFmt = (h) => {
        const num = Number(h) || 0
        if (num >= 2160) return '4k'
        if (num >= 1440) return '1440'
        if (num >= 1080) return '1080'
        if (num >= 720) return '720'
        if (num >= 480) return '480'
        return '360'
      }

      let resolveData = null
      // 1. Try serverless backend resolver first
      try {
        const resolveResp = await fetch(RESOLVE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, height: quality.height }),
        })
        if (resolveResp.ok) {
          resolveData = await resolveResp.json()
        }
      } catch (err) {
        console.warn('Backend resolver failed, trying direct resolver...', err)
      }

      // 2. If backend resolver was unavailable or returned non-200, try direct browser init (CORS enabled)
      if (!resolveData?.taskId && !resolveData?.downloadUrl) {
        const fmt = mapHeightToFmt(quality.height)
        for (const dom of ['p.savenow.to', 'p.lbserver.xyz']) {
          try {
            const directInit = await fetch(`https://${dom}/api/v2/download?format=${fmt}&url=${encodeURIComponent(url)}`)
            if (directInit.ok) {
              const d = await directInit.json()
              if (d && (d.id || d.download_url)) {
                resolveData = {
                  success: true,
                  taskId: d.id,
                  progressUrl: d.id ? `https://${dom}/api/progress?id=${encodeURIComponent(d.id)}` : null,
                  downloadUrl: d.download_url || null,
                  filename: `${videoInfo.safeFilename}-${quality.height}p.mp4`,
                }
                break
              }
            }
          } catch (directErr) {
            console.warn(`Direct resolver on ${dom} failed:`, directErr)
          }
        }
      }

      if (resolveData && (resolveData.taskId || resolveData.downloadUrl)) {
        const outName = resolveData.filename || `${videoInfo.safeFilename}-${quality.height}p.mp4`
        let finalUrl = resolveData.downloadUrl || null

        // If no immediate download URL, poll progress directly from browser (residential IP)
        if (!finalUrl && resolveData.progressUrl) {
          const MAX_POLLS = 45
          const POLL_MS = 1000
          setMessage(`Preparing ${quality.label} stream... (polling progress)`)
          for (let i = 0; i < MAX_POLLS; i++) {
            await new Promise((r) => setTimeout(r, POLL_MS))
            try {
              const prog = await fetch(resolveData.progressUrl).then((r) => r.json())
              if (prog && prog.success === 1 && prog.download_url) {
                finalUrl = prog.download_url
                break
              }
              const pct = prog?.progress ? Math.min(Math.round((prog.progress / 1000) * 100), 99) : null
              if (pct !== null) setMessage(`Preparing ${quality.label} stream... ${pct}%`)
            } catch {
              // ignore transient errors, keep polling
            }
          }
        }

        if (finalUrl) {
          setMessage(`Downloading ${outName}...`)
          try {
            const blob = await fetchVideoBlob(finalUrl)
            const objectUrl = downloadBlob(blob, outName, previewWindow)
            setStatus('success')
            setMessage(`Download complete: ${outName}`)
            setDownloadLink(objectUrl ? { url: objectUrl, filename: outName } : null)
            return
          } catch (blobErr) {
            console.warn('Direct blob fetch failed, trying iframe download trigger:', blobErr)
            // Fallback: trigger download without navigating the main window or opening a new tab
            const iframe = document.createElement('iframe')
            iframe.style.display = 'none'
            iframe.src = finalUrl
            document.body.appendChild(iframe)
            setTimeout(() => iframe.remove(), 60000)

            setStatus('success')
            setMessage(`Download started: ${outName}`)
            setDownloadLink({ url: finalUrl, filename: outName })
            return
          }
        }
      }


      // Secondary fallback: in-browser proxy and client-side mux
      if (quality.needsMux && videoInfo.audio) {
        setMessage(`Downloading ${quality.label} video track...`)
        const videoBlob = await fetchVideoBlob(quality.videoProxyUrl)

        setMessage(`Downloading highest audio track...`)
        const audioBlob = await fetchVideoBlob(videoInfo.audio.audioProxyUrl, { mime: 'audio/mp4' })

        let merged
        try {
          const { muxVideoAudio } = await import('../lib/mux')
          merged = await muxVideoAudio(videoBlob, audioBlob, (s) =>
            setMessage(`Merging 4K/HD video + audio (${s})... first run loads FFmpeg (~30 MB).`))
        } catch {
          if (previewWindow && !previewWindow.closed) previewWindow.close()
          const objectUrl = downloadBlob(videoBlob, `${videoInfo.safeFilename}-${quality.height}p.${quality.ext || 'mp4'}`)
          setStatus('success')
          setMessage(`Audio merge failed, downloaded video track without sound: ${videoInfo.safeFilename}`)
          setDownloadLink(objectUrl ? { url: objectUrl, filename: `${videoInfo.safeFilename}-${quality.height}p.${quality.ext || 'mp4'}` } : null)
          return
        }

        const outName = `${videoInfo.safeFilename}-${quality.height}p.mp4`
        const objectUrl = downloadBlob(merged, outName, previewWindow)
        setStatus('success')
        setMessage(`Download ready: ${outName}`)
        setDownloadLink(objectUrl ? { url: objectUrl, filename: outName } : null)
      } else {
        setMessage(`Downloading ${videoInfo.safeFilename}...`)
        const blob = await fetchVideoBlob(quality.videoProxyUrl || quality.videoUrl)
        const outName = `${videoInfo.safeFilename}-${quality.height}p.${quality.ext || 'mp4'}`
        const objectUrl = downloadBlob(blob, outName, previewWindow)
        setStatus('success')
        setMessage(`Download ready: ${outName}`)
        setDownloadLink(objectUrl ? { url: objectUrl, filename: outName } : null)
      }
    } catch (error) {
      if (previewWindow && !previewWindow.closed) previewWindow.close()
      setStatus('error')
      const msg = error?.message || DEFAULT_ERROR
      if (msg.includes('403') || msg.includes('Upstream')) {
        setMessage(`YouTube blocked cloud streaming for this 4K stream (HTTP 403 IP check). Switch to Option 2: Windows Desktop App for direct native 4K downloading!`)
      } else {
        setMessage(msg)
      }
    }
  }

  const mainContent = (
    <>
      <center>
        <font face="Impact" size="6" color="#FF00FF" className="hero-glow">
          <span className="blink">~*~ YOUTUBE TO MP4 DOWNLOADER ~*~</span>
        </font>
      </center>

      <br />

      <DownloadsNav />

      {/* TWO OPTIONS MENU TABS */}
      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border="0">
          <tbody>
            <tr>
              <td width="50%" align="center" bgcolor={activeTab === 'web' ? '#FF00FF' : '#220033'} className="section-bar">
                <button
                  type="button"
                  onClick={() => setActiveTab('web')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: activeTab === 'web' ? '#FFFF00' : '#CCCCCC',
                    fontFamily: 'Impact',
                    fontSize: '18px',
                    cursor: 'pointer',
                    width: '100%',
                    padding: '8px 0',
                  }}
                >
                  {activeTab === 'web' ? '★ ' : ''}OPTION 1: ONLINE WEB DOWNLOAD (UP TO 4K){activeTab === 'web' ? ' ★' : ''}
                </button>
              </td>
              <td width="50%" align="center" bgcolor={activeTab === 'desktop' ? '#FF00FF' : '#220033'} className="section-bar">
                <button
                  type="button"
                  onClick={() => setActiveTab('desktop')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: activeTab === 'desktop' ? '#FFFF00' : '#CCCCCC',
                    fontFamily: 'Impact',
                    fontSize: '18px',
                    cursor: 'pointer',
                    width: '100%',
                    padding: '8px 0',
                  }}
                >
                  {activeTab === 'desktop' ? '★ ' : ''}OPTION 2: WINDOWS DESKTOP APP{activeTab === 'desktop' ? ' ★' : ''}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      {/* OPTION 1: ONLINE WEB DOWNLOADER */}
      {activeTab === 'web' && (
        <>
          <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
            <tbody>
              <tr>
                <td>
                  <font face="Comic Sans MS" size="3" color="#FFFFFF">
                    Download YouTube videos right in your browser in <b className="lime">native 4K, 1440p, 1080p, or 720p</b> without installing any desktop software!
                    Audio and video tracks are pulled directly and combined cleanly via client-side FFmpeg.
                    <br />
                    <br />
                    <font color="#FFFF00">
                      🔒 <b>Note:</b> Access to the web downloader is gated behind Google sign-in to protect server bandwidth.
                    </font>
                  </font>
                </td>
              </tr>
            </tbody>
          </table>

          <br />

          {!user ? (
            /* SIGN-IN PROMPT BOX */
            <table width="100%" cellPadding="12" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
              <tbody>
                <tr>
                  <td align="center">
                    <font face="Impact" size="5" color="#00FFFF">
                      ~ SIGN IN REQUIRED ~
                    </font>
                    <br />
                    <br />
                    <font face="Comic Sans MS" size="3" color="#FFFF00">
                      Please sign in with your Google account to unlock direct online web downloading:
                    </font>
                    <br />
                    <br />
                    <div style={{ display: 'inline-block' }}>
                      <GoogleSignInButton />
                    </div>
                    <br />
                    <br />
                    <font face="Comic Sans MS" size="2" color="#AAAAAA">
                      (Want to download without signing in? Switch to <b>Option 2: Windows Desktop App</b> above!)
                    </font>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            /* ACTIVE WEB DOWNLOADER INTERFACE */
            <table width="100%" cellPadding="10" cellSpacing="0" border="0" className="bevelbox" bgcolor="#000000">
              <tbody>
                <tr>
                  <td bgcolor="#000000">
                    <div style={{ marginBottom: '10px' }}>
                      <font face="Comic Sans MS" size="2" color="#00FF00">
                        Signed in as <b>{user.email}</b> &nbsp;&#10004; Web downloader unlocked!
                      </font>
                    </div>

                    <form className="igdl-form" onSubmit={handleInspect}>
                      <label>
                        <font face="Courier New" size="3" color="#00FF00">
                          YOUTUBE VIDEO URL:
                        </font>
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                          disabled={status === 'loading'}
                        />
                      </label>

                      <center>
                        <button type="submit" className="igdl-submit" disabled={status === 'loading'}>
                          {status === 'loading' && !videoInfo ? '~ FETCHING FORMATS ~' : <>&#128269; INSPECT VIDEO &#128269;</>}
                        </button>
                      </center>
                    </form>

                    {/* VIDEO DETAILS & QUALITY PICKER */}
                    {videoInfo && (
                      <>
                        <br />
                        <table width="100%" cellPadding="8" cellSpacing="0" border="0" style={{ border: '2px dashed #00FFFF', backgroundColor: '#110022' }}>
                          <tbody>
                            <tr>
                              <td width="160" align="center" valign="top">
                                <img
                                  src={videoInfo.thumbnail || `https://i.ytimg.com/vi/${videoInfo.id}/hqdefault.jpg`}
                                  alt={videoInfo.title}
                                  referrerPolicy="no-referrer"
                                  crossOrigin="anonymous"
                                  onError={(e) => {
                                    if (videoInfo.id && !e.currentTarget.src.includes('mqdefault')) {
                                      e.currentTarget.src = `https://i.ytimg.com/vi/${videoInfo.id}/mqdefault.jpg`
                                    }
                                  }}
                                  style={{
                                    width: '150px',
                                    height: 'auto',
                                    display: 'block',
                                    border: '2px solid #FF00FF',
                                    borderRadius: '4px',
                                    boxShadow: '0 0 8px #FF00FF',
                                    backgroundColor: '#000000',
                                  }}
                                />
                              </td>
                              <td valign="top">
                                <font face="Impact" size="4" color="#FFFF00">
                                  {videoInfo.title}
                                </font>
                                <br />
                                <br />
                                <label>
                                  <font face="Courier New" size="3" color="#00FFFF">
                                    SELECT QUALITY (NATIVE UP TO 4K):
                                  </font>
                                  <select
                                    value={selectedQuality}
                                    onChange={(e) => setSelectedQuality(e.target.value)}
                                    disabled={status === 'loading'}
                                    style={{
                                      background: '#000000',
                                      color: '#FFFF00',
                                      border: '2px solid #00FF00',
                                      padding: '6px',
                                      fontFamily: 'Comic Sans MS',
                                      fontSize: '14px',
                                      marginTop: '4px',
                                      width: '100%',
                                    }}
                                  >
                                    {videoInfo.qualities.map((q) => (
                                      <option key={q.height} value={q.height}>
                                        {q.label} {q.fps > 30 ? `(${q.fps}fps)` : ''} {q.needsMux ? '— Lossless High Quality Mux' : '— Progressive'}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                                <br />
                                <br />
                                <button
                                  type="button"
                                  onClick={handleDownload}
                                  className="igdl-submit"
                                  disabled={status === 'loading'}
                                  style={{ fontSize: '18px', padding: '8px 20px' }}
                                >
                                  {status === 'loading' ? '~ MERGING & DOWNLOADING ~' : <>&#11015; START 4K / HD DOWNLOAD &#11015;</>}
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </>
                    )}

                    {message && (
                      <>
                        <br />
                        <div className={`igdl-status igdl-status-${status}`}>
                          <font face="Comic Sans MS" size="3" color={status === 'error' ? '#FF0000' : '#FFFF00'}>
                            {status === 'success' && downloadLink ? (
                              <>
                                Download complete:{' '}
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
          )}
        </>
      )}

      {/* OPTION 2: WINDOWS DESKTOP APP */}
      {activeTab === 'desktop' && (
        <>
          {/* TITLE SECTION BAR */}
          <center>
            <table width="100%" cellPadding="0" cellSpacing="0" border="0">
              <tbody>
                <tr>
                  <td align="center" bgcolor="#FF00FF" className="section-bar">
                    <font face="Impact" size="5" color="#FFFF00">
                      ~*~ YtMp4 - Windows Desktop Application ~*~
                    </font>
                  </td>
                </tr>
              </tbody>
            </table>
          </center>

          <br />

          {/* DESCRIPTION */}
          <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
            <tbody>
              <tr>
                <td>
                  <font face="Comic Sans MS" size="3" color="#FFFFFF">
                    OK so I built this thing because I was SICK of sketchy websites trying to
                    convert YouTube videos with a billion popup ads!!! This is a{' '}
                    <b className="lime">real Windows app</b> that runs on your computer, grabs
                    the <b className="yellow">best quality video + audio</b>, smashes them together
                    with FFmpeg, and spits out a clean MP4 with{' '}
                    <b className="hotpink">pristine original audio</b> — no re-encoding, no clipping!!!
                    <br />
                    <br />
                    It&rsquo;s powered under the hood by{' '}
                    <b className="cyan">yt-dlp</b> and <b className="cyan">ffmpeg</b> — both
                    bundled in the zip so you don&rsquo;t have to install ANYTHING!!! Just
                    extract and double-click!!!
                  </font>
                </td>
              </tr>
            </tbody>
          </table>

          <br />

          {/* FEATURES */}
          <center>
            <table width="100%" cellPadding="0" cellSpacing="0" border="0">
              <tbody>
                <tr>
                  <td align="center" bgcolor="#00FFFF" className="section-bar">
                    <font face="Impact" size="4" color="#000000">
                      ~ FEATURES ~
                    </font>
                  </td>
                </tr>
              </tbody>
            </table>
          </center>

          <br />

          <table width="100%" cellPadding="6" cellSpacing="4" border="0">
            <tbody>
              {[
                ['#FF00FF', 'Best available quality video + audio, merged into one MP4'],
                ['#00FF00', '16 parallel download fragments = BLAZING FAST speeds!!!'],
                ['#FFFF00', 'Original audio preserved bit-for-bit — zero quality loss!!!'],
                ['#00FFFF', 'Real-time progress bar with live download speed readout'],
                ['#FF00FF', 'Cancel anytime without leaving junk files behind'],
                ['#00FF00', 'No .NET runtime needed — fully self-contained!!!'],
                ['#FFFF00', 'Open the file or folder when done with one click!!!'],
              ].map(([color, text], i) => (
                <tr key={i}>
                  <td width="30" align="center">
                    <font face="Impact" size="4" color={color}>&#9733;</font>
                  </td>
                  <td bgcolor="#000000" className="feature-row">
                    <font face="Comic Sans MS" size="3" color="#FFFFFF">{text}</font>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <br />

          {/* DOWNLOAD BUTTON */}
          <center>
            <table cellPadding="0" cellSpacing="0" border="0">
              <tbody>
                <tr>
                  <td className="dl-btn-wrap">
                    <a href="https://github.com/sacor10/ytmp4/releases/latest/download/ytmp4.zip" className="dl-btn" download>
                      &#11015; DOWNLOAD YTMP4 v1.2 &#11015;
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
            <br />
            <font face="Comic Sans MS" size="2" color="#FFFF00">
              ~350 MB zip &nbsp;&#9733;&nbsp; Windows 10/11 x64 &nbsp;&#9733;&nbsp; 100% FREE &nbsp;&#9733;&nbsp; NO LOGIN REQUIRED
            </font>
          </center>

          <br />
          <br />

          {/* HOW TO USE */}
          <center>
            <table width="100%" cellPadding="0" cellSpacing="0" border="0">
              <tbody>
                <tr>
                  <td align="center" bgcolor="#FFFF00" className="section-bar">
                    <font face="Impact" size="4" color="#000000">
                      ~ HOW TO USE IT ~
                    </font>
                  </td>
                </tr>
              </tbody>
            </table>
          </center>

          <br />

          <table width="100%" cellPadding="8" cellSpacing="0" border="0" className="postbox">
            <tbody>
              <tr>
                <td>
                  <font face="Comic Sans MS" size="3" color="#FFFFFF">
                    {[
                      'Click the DOWNLOAD button above',
                      'Extract the ZIP to any folder you like',
                      'Double-click YtMp4.exe to launch',
                      'Paste a YouTube URL into the box',
                      'Pick a folder to save your MP4',
                      'Click Download and watch the magic happen!!!',
                      'Profit!!!',
                    ].map((step, i) => (
                      <span key={i}>
                        <font color="#FFFF00">
                          <b>{i + 1}.</b>
                        </font>{' '}
                        {step}
                        <br />
                      </span>
                    ))}
                  </font>
                </td>
              </tr>
            </tbody>
          </table>

          <br />

          <center>
            <font face="Comic Sans MS" size="2" color="#888888">
              Built with C# / WPF / .NET 9 &nbsp;&#9733;&nbsp; Powered by yt-dlp &amp; FFmpeg
              &nbsp;&#9733;&nbsp; <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
            </font>
          </center>
        </>
      )}

      <br />
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={<RightSidebar activeTab={activeTab} />} />
}
