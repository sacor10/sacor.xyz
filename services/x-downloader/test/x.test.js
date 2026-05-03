import assert from 'node:assert/strict'
import test from 'node:test'
import { DownloaderError } from '../src/errors.js'
import { validateXUrl } from '../src/x.js'

test('accepts supported public X and Twitter status URL shapes', () => {
  assert.deepEqual(validateXUrl('https://x.com/example/status/1234567890?s=20'), {
    href: 'https://x.com/example/status/1234567890',
    id: '1234567890',
  })

  assert.equal(
    validateXUrl('https://www.twitter.com/example/status/9876543210/photo/1').href,
    'https://x.com/example/status/9876543210',
  )

  assert.equal(
    validateXUrl('http://mobile.twitter.com/i/web/status/5555555555').href,
    'https://x.com/i/web/status/5555555555',
  )
})

test('rejects unsupported and non-status URLs', () => {
  const badUrls = [
    '',
    'not a url',
    'ftp://x.com/example/status/123456',
    'https://example.com/example/status/123456',
    'https://x.com.evil.test/example/status/123456',
    'https://x.com/example',
    'https://x.com/example/status/notanid',
  ]

  for (const url of badUrls) {
    assert.throws(
      () => validateXUrl(url),
      (error) => error instanceof DownloaderError && error.code === 'invalid_url',
    )
  }
})
