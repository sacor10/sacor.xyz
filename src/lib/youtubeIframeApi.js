// Load YouTube's IFrame Player API exactly once and resolve when it's ready.
//
// We use the real API (rather than raw postMessage) because it delivers
// onError / onStateChange events across the cross-origin frame — that's what
// lets us tell "the channel is live and playing" from "there's no broadcast, so
// YouTube is showing its error screen" without any server-side call (which
// YouTube bot-blocks from datacenter IPs).

let apiPromise = null

export function loadYoutubeIframeApi() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('no window'))
  }
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT)
  }
  if (apiPromise) return apiPromise

  apiPromise = new Promise((resolve, reject) => {
    // YouTube calls this global once iframe_api finishes loading. Chain any
    // existing handler so we never clobber another consumer.
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous()
      resolve(window.YT)
    }

    const existing = document.querySelector('script[data-youtube-iframe-api]')
    if (!existing) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.async = true
      tag.dataset.youtubeIframeApi = 'true'
      tag.onerror = () => reject(new Error('failed to load YouTube IFrame API'))
      document.head.appendChild(tag)
    }
  })

  return apiPromise
}
