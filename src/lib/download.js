export async function fetchVideoBlob(url, { mime = 'video/mp4' } = {}) {
  const res = await fetch(url, { credentials: 'omit' })
  if (!res.ok) throw new Error(`Could not fetch video (HTTP ${res.status}).`)
  const raw = await res.blob()
  return mime ? raw.slice(0, raw.size, mime) : raw
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
