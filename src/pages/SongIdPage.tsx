import { useRef, useState } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import Layout from '../Layout'
import DownloadsNav from '../components/DownloadsNav'
import type { IdentifyOutcome } from '../../netlify/functions/_lib/songid/types'
import { MAX_SOURCE_FILE_BYTES } from '../lib/songid/constants'
import { sniffMediaKind } from '../lib/songid/magicBytes'

const API_ENDPOINT = '/.netlify/functions/song-identify'
const ACCEPT = '.mp4,.mov,.webm,.mp3,.m4a,.wav,.ogg,video/*,audio/*'

type PageState =
  | { kind: 'idle' }
  | { kind: 'working'; stage: 'decoding' | 'extracting' | 'identifying' }
  | { kind: 'done'; outcome: IdentifyOutcome }
  | { kind: 'error'; message: string }

const STAGE_LABELS: Record<'decoding' | 'extracting' | 'identifying', string> = {
  decoding: 'DECODING AUDIO... (first run downloads a ~30 MB decoder)',
  extracting: 'PICKING THE LOUDEST 12 SECONDS...',
  identifying: 'ASKING THE MUSIC ORACLE...',
}

/** "matched at 1.25×" → the uploaded edit plays at about 1/1.25 = 0.8× speed. */
const speedNote = (factor: number): string | null => {
  if (factor === 1) return null
  const editSpeed = (1 / factor).toFixed(2).replace(/0$/, '')
  const direction = factor > 1 ? 'slowed to' : 'sped up to'
  return `Matched at ${factor}× — this clip is ${direction} about ${editSpeed}× of the original speed.`
}

async function identify(file: File, setState: (s: PageState) => void): Promise<void> {
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    setState({ kind: 'error', message: 'That file is over 50 MB. Trim it down first — only 12 seconds get analyzed anyway.' })
    return
  }
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (!sniffMediaKind(head)) {
    setState({ kind: 'error', message: 'That does not look like a supported file. Feed me mp4, mov, webm, mp3, m4a, wav, or ogg.' })
    return
  }

  try {
    const { extractAnalysisClip } = await import('../lib/songid/extractClip')
    const clip = await extractAnalysisClip(file, (stage) => setState({ kind: 'working', stage }))
    setState({ kind: 'working', stage: 'identifying' })
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: clip as unknown as BodyInit,
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      throw new Error(body?.message || 'Identification failed. Try again in a bit.')
    }
    const outcome = (await response.json()) as IdentifyOutcome
    setState({ kind: 'done', outcome })
  } catch (error) {
    setState({ kind: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' })
  }
}

function ResultCard({ outcome }: { outcome: IdentifyOutcome }) {
  if (outcome.status === 'no_match') {
    return (
      <div className="igdl-status">
        <font face="Impact" size="4" color="#00FFFF">NO MATCH — BUT DON'T GIVE UP</font>
        <br />
        <font face="Comic Sans MS" size="2" color="#FFFFFF">
          The oracle listened {outcome.attemptsUsed > 1 ? `at ${outcome.attemptsUsed} playback speeds` : 'carefully'} and came up empty.
          That usually means the music is buried under talking, or it's a remix/live version.
          <br /><br />
          Try: a section where the music is loudest and cleanest &nbsp;&#9733;&nbsp; a longer source file
          so there's more to choose from &nbsp;&#9733;&nbsp; or hum it into a music-recognition app, which
          handles covers better.
        </font>
      </div>
    )
  }

  const { result, matchedFactor } = outcome
  const note = speedNote(matchedFactor)
  return (
    <div className="igdl-status">
      <table cellPadding="6" cellSpacing="0" border={0}>
        <tbody>
          <tr>
            {result.coverArtUrl && (
              <td valign="top">
                <img src={result.coverArtUrl} alt={`Cover art for ${result.album || result.title}`} width="120" height="120" className="bevelbox" />
              </td>
            )}
            <td valign="top">
              <font face="Impact" size="5" color="#00FF00">{result.title}</font>
              <br />
              <font face="Comic Sans MS" size="3" color="#FFFFFF">by <b className="cyan">{result.artist}</b></font>
              <br />
              <font face="Comic Sans MS" size="2" color="#FFFF00">
                {result.album && <>Album: {result.album}<br /></>}
                {result.releaseDate && <>Released: {result.releaseDate}<br /></>}
                {result.confidence != null && <>Confidence: {Math.round(result.confidence * 100)}%<br /></>}
              </font>
              <font face="Comic Sans MS" size="2">
                {result.spotifyUrl && (
                  <a href={result.spotifyUrl} target="_blank" rel="noreferrer" className="lime">&#9654; Spotify</a>
                )}
                {result.spotifyUrl && result.appleMusicUrl && <>&nbsp;&nbsp;</>}
                {result.appleMusicUrl && (
                  <a href={result.appleMusicUrl} target="_blank" rel="noreferrer" className="hotpink">&#9654; Apple Music</a>
                )}
              </font>
            </td>
          </tr>
        </tbody>
      </table>
      {note && (
        <font face="Courier New" size="2" color="#00FFFF">{note}</font>
      )}
    </div>
  )
}

function Sidebar() {
  return (
    <>
      <table width="100%" cellPadding="8" cellSpacing="0" border={0} className="bevelbox">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FF00FF" className="section-bar-sm">
              <font face="Impact" size="4" color="#FFFF00">~ HOW IT WORKS ~</font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#FFFFFF">
                Your file never leaves the browser. The audio is decoded locally, the loudest
                12 seconds get clipped out, and only that tiny clip (about 1 MB) is sent off for
                identification. Nothing is stored.
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border={0} className="bevelbox">
        <tbody>
          <tr>
            <td align="center" bgcolor="#00FFFF" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">~ SLOWED + REVERB? ~</font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#00FF00">
                Slowed and nightcore edits break normal song recognition. This tool replays your
                clip at several speeds (1×, 1.25×, and friends) until one of them matches, and
                tells you how much the edit was shifted.
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <table width="100%" cellPadding="8" cellSpacing="0" border={0} className="bevelbox" bgcolor="#4B0082">
        <tbody>
          <tr>
            <td align="center" bgcolor="#FFFF00" className="section-bar-sm">
              <font face="Impact" size="4" color="#000000">~ HOUSE RULES ~</font>
            </td>
          </tr>
          <tr>
            <td bgcolor="#000000">
              <font face="Comic Sans MS" size="2" color="#FFFFFF">
                10 lookups per hour, files up to 50 MB: mp4, mov, webm, mp3, m4a, wav, ogg.
                Music only — it won't name your neighbor's dog from a bark.
              </font>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

export default function SongIdPage() {
  const [state, setState] = useState<PageState>({ kind: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = state.kind === 'working'

  const handleFile = (file: File | undefined | null) => {
    if (!file || busy) return
    void identify(file, setState)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    handleFile(event.dataTransfer.files?.[0])
  }

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0])
    event.target.value = '' // same file can be picked again after a retry
  }

  const mainContent = (
    <>
      <center>
        <font face="Impact" size="6" color="#FF00FF" className="hero-glow">
          <span className="blink">~*~ WHAT'S THAT SONG? ~*~</span>
        </font>
      </center>

      <br />

      <DownloadsNav />

      <table width="100%" cellPadding="8" cellSpacing="0" border={0} className="postbox">
        <tbody>
          <tr>
            <td>
              <font face="Comic Sans MS" size="3" color="#FFFFFF">
                Got a video with a song you can't name? Drop it here. The loudest 12 seconds get
                analyzed and matched against a giant fingerprint database &mdash; even if the edit
                is slowed down or nightcore'd.
              </font>
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <center>
        <table width="100%" cellPadding="0" cellSpacing="0" border={0}>
          <tbody>
            <tr>
              <td align="center" bgcolor="#00FFFF" className="section-bar">
                <font face="Impact" size="5" color="#000000">~ FEED ME AUDIO ~</font>
              </td>
            </tr>
          </tbody>
        </table>
      </center>

      <br />

      <table width="100%" cellPadding="10" cellSpacing="0" border={0} className="bevelbox" bgcolor="#000000">
        <tbody>
          <tr>
            <td bgcolor="#000000">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => { if (!busy) inputRef.current?.click() }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' && !busy) inputRef.current?.click() }}
                style={{
                  border: `3px dashed ${dragOver ? '#00FF00' : '#FF00FF'}`,
                  padding: '28px 12px',
                  textAlign: 'center',
                  cursor: busy ? 'wait' : 'pointer',
                  background: dragOver ? '#1a001a' : 'transparent',
                }}
              >
                <font face="Impact" size="4" color={dragOver ? '#00FF00' : '#00FFFF'}>
                  {busy ? '~ WORKING ~' : '⇩ DROP A VIDEO OR AUDIO FILE ⇩'}
                </font>
                <br />
                <font face="Comic Sans MS" size="2" color="#888888">
                  or click to browse &nbsp;&#9733;&nbsp; mp4 / mov / webm / mp3 / m4a / wav / ogg &nbsp;&#9733;&nbsp; max 50 MB
                </font>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  onChange={onPick}
                  disabled={busy}
                  style={{ display: 'none' }}
                />
              </div>

              {state.kind === 'working' && (
                <>
                  <br />
                  <div className="igdl-status">
                    <font face="Courier New" size="3" color="#FFFF00">
                      <span className="blink">&#9835;</span> {STAGE_LABELS[state.stage]}
                    </font>
                  </div>
                </>
              )}

              {state.kind === 'error' && (
                <>
                  <br />
                  <div className="igdl-status igdl-status-error">
                    <font face="Comic Sans MS" size="3" color="#FF0000">{state.message}</font>
                  </div>
                </>
              )}

              {state.kind === 'done' && (
                <>
                  <br />
                  <ResultCard outcome={state.outcome} />
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      <br />

      <center>
        <font face="Comic Sans MS" size="2" color="#888888">
          Powered by audio fingerprinting &nbsp;&#9733;&nbsp;
          <a href="mailto:vestibule@sacor.xyz">report bugs here</a>
        </font>
      </center>

      <br />
    </>
  )

  return <Layout mainContent={mainContent} rightSidebar={<Sidebar />} />
}
