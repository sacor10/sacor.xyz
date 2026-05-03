import assert from 'node:assert/strict'
import test from 'node:test'
import { DownloaderError } from '../src/errors.js'
import { validateInstagramUrl } from '../src/instagram.js'

test('accepts supported public Instagram post URL shapes', () => {
  assert.deepEqual(validateInstagramUrl('https://www.instagram.com/reel/ABC123/?igsh=abc'), {
    href: 'https://www.instagram.com/reel/ABC123/',
    shortcode: 'ABC123',
    type: 'reel',
  })

  assert.equal(
    validateInstagramUrl('https://m.instagram.com/p/POST_456/').href,
    'https://www.instagram.com/p/POST_456/',
  )

  assert.equal(
    validateInstagramUrl('http://instagram.com/tv/TV789/').href,
    'https://www.instagram.com/tv/TV789/',
  )
})

test('rejects unsupported URLs with invalid_url', () => {
  const invalid = [
    '',
    'not a url',
    'ftp://instagram.com/reel/ABC123/',
    'https://instagram.com/stories/example/123/',
    'https://instagram.com/explore/tags/video/',
    'https://instagram.com.evil.test/reel/ABC123/',
  ]

  for (const url of invalid) {
    assert.throws(
      () => validateInstagramUrl(url),
      (error) => error instanceof DownloaderError && error.code === 'invalid_url',
    )
  }
})
