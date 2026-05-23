import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createApp } from '../src/server.js'

const baseConfig = {
  allowedOrigins: ['http://localhost:5173'],
  extractTimeoutMs: 1000,
  maxItems: 20,
  maxVideoBytes: 1024 * 1024,
  mediaTimeoutMs: 1000,
  port: 0,
}

function video(overrides = {}) {
  return {
    ext: 'mp4',
    id: 'dQw4w9WgXcQ',
    index: 1,
    pageUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Test Clip',
    url: 'https://cdn.example/test.mp4',
    ...overrides,
  }
}

async function withServer(app, callback) {
  const server = app.listen(0)
  await once(server, 'listening')
  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`

  try {
    await callback(baseUrl)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

test('GET /healthz returns ok', async () => {
  const app = createApp({ config: baseConfig })

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/healthz`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
  })
})

test('POST /download rejects invalid URLs as JSON', async () => {
  const app = createApp({
    config: baseConfig,
    extractVideos: async () => [video()],
  })

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/download`, {
      body: JSON.stringify({ url: 'https://example.com/reel/ABC/' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      code: 'invalid_url',
      message: 'Only YouTube video URLs are supported.',
    })
  })
})

test('POST /download returns no_videos when extraction finds nothing', async () => {
  const app = createApp({
    config: baseConfig,
    extractVideos: async () => [],
  })

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/download`, {
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    assert.equal(response.status, 404)
    assert.equal((await response.json()).code, 'no_videos')
  })
})

test('POST /download rejects disallowed origins', async () => {
  const app = createApp({
    config: baseConfig,
    extractVideos: async () => [video()],
  })

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/download`, {
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example',
      },
      method: 'POST',
    })

    assert.equal(response.status, 403)
    assert.equal((await response.json()).code, 'forbidden_origin')
  })
})

test('POST /download streams a single MP4 with attachment headers', async () => {
  const app = createApp({
    config: baseConfig,
    extractVideos: async () => [video()],
    fetchImpl: async () => new Response(Buffer.from('video-body'), {
      headers: {
        'content-length': '10',
        'content-type': 'video/mp4',
      },
      status: 200,
    }),
  })

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/download`, {
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'video/mp4')
    assert.match(response.headers.get('content-disposition'), /Test%20Clip\.mp4/)
    assert.equal(Buffer.from(await response.arrayBuffer()).toString(), 'video-body')
  })
})

test('POST /download streams a ZIP for multiple videos', async () => {
  const app = createApp({
    config: baseConfig,
    extractVideos: async () => [
      video({ index: 1, title: 'First Clip', url: 'https://cdn.example/first.mp4' }),
      video({ index: 2, title: 'Second Clip', url: 'https://cdn.example/second.mp4' }),
    ],
    fetchImpl: async (url) => new Response(Buffer.from(url.includes('first') ? 'first' : 'second'), {
      headers: {
        'content-type': 'video/mp4',
      },
      status: 200,
    }),
  })

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/download`, {
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    const buffer = Buffer.from(await response.arrayBuffer())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/zip')
    assert.match(response.headers.get('content-disposition'), /First%20Clip-videos\.zip/)
    assert.equal(buffer.subarray(0, 2).toString(), 'PK')
  })
})

test('POST /download maps extractor failures to extract_failed', async () => {
  const app = createApp({
    config: baseConfig,
    extractVideos: async () => {
      throw new Error('upstream exploded')
    },
  })

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/download`, {
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    assert.equal(response.status, 502)
    assert.equal((await response.json()).code, 'extract_failed')
  })
})

test('POST /download maps media fetch failures to download_failed', async () => {
  const app = createApp({
    config: baseConfig,
    extractVideos: async () => [video()],
    fetchImpl: async () => new Response('missing', { status: 404 }),
  })

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/download`, {
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    assert.equal(response.status, 502)
    assert.equal((await response.json()).code, 'download_failed')
  })
})
