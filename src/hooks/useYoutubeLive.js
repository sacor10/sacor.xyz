import { useEffect, useState } from 'react'

// How often to re-check while a visitor sits on the page. Someone waiting for
// the 09:00 PT stream should see it flip to live without a manual refresh, but
// we don't need to hammer the endpoint — it's edge-cached for 60s anyway.
const POLL_MS = 60_000

// Build the embed URL for a specific live video id. Embedding by video id is
// reliable (it plays or it doesn't), unlike embed/live_stream?channel= which
// renders YouTube's raw error screen whenever the channel is offline.
export function livestreamEmbedSrc(videoId) {
  return (
    `https://www.youtube.com/embed/${videoId}` +
    '?autoplay=1&mute=1&enablejsapi=1&modestbranding=1&rel=0&playsinline=1'
  )
}

// Resolve whether a YouTube channel is live right now via the server-side
// youtube-live-check function.
//
// The browser can't tell that a cross-origin YouTube embed failed, so the old
// embed/live_stream?channel= players just showed YouTube's raw error screen
// whenever the channel was offline. This asks the server instead and returns:
//   { status: 'loading' }                 initial fetch in flight
//   { status: 'live', videoId }           streaming now — embed this exact video
//   { status: 'offline', videoId: null }  not live; show a friendly card
//   { status: 'error', videoId: null }    couldn't reach the checker
export function useYoutubeLive(channelId) {
  const [state, setState] = useState(() => ({
    status: channelId ? 'loading' : 'offline',
    videoId: null,
  }))

  useEffect(() => {
    if (!channelId) return

    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch(
          `/.netlify/functions/youtube-live-check?channel=${encodeURIComponent(channelId)}`,
          { headers: { Accept: 'application/json' } },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        setState(
          data?.live && data.videoId
            ? { status: 'live', videoId: data.videoId }
            : { status: 'offline', videoId: null },
        )
      } catch {
        if (!cancelled) setState({ status: 'error', videoId: null })
      }
    }

    check()
    const timer = window.setInterval(check, POLL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [channelId])

  return state
}
