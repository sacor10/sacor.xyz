import { describe, expect, it } from 'vitest'
import { sniffMediaKind } from '../../src/lib/songid/magicBytes'

const bytes = (...values: (number | string)[]): Uint8Array => {
  const out: number[] = []
  for (const v of values) {
    if (typeof v === 'string') for (const ch of v) out.push(ch.charCodeAt(0))
    else out.push(v)
  }
  while (out.length < 16) out.push(0)
  return Uint8Array.from(out)
}

describe('sniffMediaKind', () => {
  it('detects ISO-BMFF (mp4/mov/m4a) by ftyp box', () => {
    expect(sniffMediaKind(bytes(0, 0, 0, 0x20, 'ftypisom'))).toBe('mp4')
    expect(sniffMediaKind(bytes(0, 0, 0, 0x14, 'ftypqt  '))).toBe('mp4')
  })

  it('detects webm/matroska by EBML header', () => {
    expect(sniffMediaKind(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe('webm')
  })

  it('detects wav, ogg, and mp3', () => {
    expect(sniffMediaKind(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBe('wav')
    expect(sniffMediaKind(bytes('OggS'))).toBe('ogg')
    expect(sniffMediaKind(bytes('ID3', 4, 0))).toBe('mp3')
    expect(sniffMediaKind(bytes(0xff, 0xfb, 0x90))).toBe('mp3')
  })

  it('rejects unknown types and tiny buffers', () => {
    expect(sniffMediaKind(bytes(0x89, 'PNG'))).toBeNull() // png is not audio
    expect(sniffMediaKind(new TextEncoder().encode('hello world!!'))).toBeNull()
    expect(sniffMediaKind(new Uint8Array(4)))
      .toBeNull()
  })
})
