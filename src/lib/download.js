export function isIOS() {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return false
  const ua = navigator.userAgent || ''
  // iPad on iPadOS 13+ reports as Macintosh; disambiguate via touch points.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

// iOS Safari ignores the <a download> attribute, so anchor-click downloads do
// nothing visible. The workaround is to open the blob in a new tab where
// Safari's fullscreen player takes over and the user can long-press → Save to
// Photos. Popups are blocked unless opened synchronously inside a user gesture,
// so the React submit handler must call this BEFORE any async work and pass
// the returned window into downloadBlob.
export function openPreviewWindow() {
  if (!isIOS() || typeof window === 'undefined') return null
  let win
  try {
    win = window.open('', '_blank')
  } catch {
    return null
  }
  if (win) {
    try {
      win.document.write(
        '<title>Loading video…</title>'
        + '<meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<div style="font-family:-apple-system,sans-serif;padding:2em;text-align:center;color:#444">Loading video…</div>',
      )
    } catch { /* cross-origin or already navigated; ignore */ }
  }
  return win
}

export async function fetchVideoBlob(url, { mime = 'video/mp4' } = {}) {
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok) throw new Error(`Could not fetch video (HTTP ${res.status}).`)
  const raw = await res.blob()
  return mime ? raw.slice(0, raw.size, mime) : raw
}

export function downloadBlob(blob, filename, previewWindow = null) {
  const objectUrl = URL.createObjectURL(blob)
  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.href = objectUrl
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    return null
  }
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 300000)
  return objectUrl
}
