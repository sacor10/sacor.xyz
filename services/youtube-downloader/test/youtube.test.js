import assert from 'node:assert/strict'
import test from 'node:test'
import { DownloaderError } from '../src/errors.js'
import { validateYouTubeUrl } from '../src/youtube.js'

const VIDEO_ID = 'dQw4w9WgXcQ'
const CANONICAL = `https://www.youtube.com/watch?v=${VIDEO_ID}`

test('accepts supported YouTube video URL shapes', () => {
  assert.deepEqual(validateYouTubeUrl(`https://www.youtube.com/watch?v=${VIDEO_ID}&list=PL123`), {
    href: CANONICAL,
    videoId: VIDEO_ID,
  })

  assert.equal(validateYouTubeUrl(`https://youtu.be/${VIDEO_ID}?si=abc`).href, CANONICAL)
  assert.equal(validateYouTubeUrl(`https://m.youtube.com/shorts/${VIDEO_ID}`).href, CANONICAL)
  assert.equal(validateYouTubeUrl(`https://music.youtube.com/watch?v=${VIDEO_ID}`).href, CANONICAL)
  assert.equal(validateYouTubeUrl(`https://www.youtube.com/embed/${VIDEO_ID}`).href, CANONICAL)
  assert.equal(validateYouTubeUrl(`https://www.youtube-nocookie.com/embed/${VIDEO_ID}`).href, CANONICAL)
})

test('rejects unsupported URLs with invalid_url', () => {
  const invalid = [
    '',
    'not a url',
    `ftp://youtube.com/watch?v=${VIDEO_ID}`,
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?v=bad',
    'https://youtube.com/channel/UCabc1234567',
    'https://youtube.com/playlist?list=PLabc1234567',
    'https://youtu.be/',
    'https://youtube.com/shorts/not-valid',
  ]

  for (const url of invalid) {
    assert.throws(
      () => validateYouTubeUrl(url),
      (error) => error instanceof DownloaderError && error.code === 'invalid_url',
    )
  }
})
