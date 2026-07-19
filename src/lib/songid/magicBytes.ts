// File-type sniffing by magic bytes. Extensions and client MIME types are
// user-controlled, so acceptance is decided from the first bytes only.

export type MediaKind = 'mp4' | 'webm' | 'mp3' | 'wav' | 'ogg'

const ascii = (bytes: Uint8Array, offset: number, text: string): boolean => {
  if (offset + text.length > bytes.length) return false
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false
  }
  return true
}

/**
 * Returns the container kind, or null when the bytes match no supported
 * format. mp4/mov/m4a share the ISO-BMFF `ftyp` box; webm is EBML.
 */
export function sniffMediaKind(bytes: Uint8Array): MediaKind | null {
  if (bytes.length < 12) return null
  if (ascii(bytes, 4, 'ftyp')) return 'mp4'
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm'
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WAVE')) return 'wav'
  if (ascii(bytes, 0, 'OggS')) return 'ogg'
  if (ascii(bytes, 0, 'ID3')) return 'mp3'
  // Raw MPEG audio frame sync: 11 set bits.
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'mp3'
  return null
}
