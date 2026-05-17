export async function fetchVideoBlob(url, { mime = 'video/mp4' } = {}) {
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok) throw new Error(`Could not fetch video (HTTP ${res.status}).`)
  const raw = await res.blob()
  return mime ? raw.slice(0, raw.size, mime) : raw
}

function canShareFile(file) {
  return typeof navigator !== 'undefined'
    && typeof navigator.canShare === 'function'
    && typeof navigator.share === 'function'
    && navigator.canShare({ files: [file] })
}

// On mobile (iOS Safari 15+, Android Chromium), opens the native share sheet so
// the user can pick "Save Video" / "Save to Gallery" — the only path a web app
// has to land a file in the camera roll. Falls back to a plain blob download on
// desktop and browsers without Web Share Level 2.
export async function saveOrShareBlob(blob, filename, { mime = 'video/mp4' } = {}) {
  const typed = blob.type === mime ? blob : blob.slice(0, blob.size, mime)
  try {
    const file = new File([typed], filename, { type: mime })
    if (canShareFile(file)) {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    }
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled'
    // any other share failure: fall through to download
  }
  downloadBlob(typed, filename)
  return 'downloaded'
}

export function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}
