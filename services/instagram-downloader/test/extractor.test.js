import assert from 'node:assert/strict'
import test from 'node:test'
import { collectVideoItems, filenameForVideo, zipFilename } from '../src/extractor.js'

test('collectVideoItems filters photos, dedupes URLs, and caps at maxItems', () => {
  const entries = [
    {
      ext: 'jpg',
      id: 'photo-only',
      title: 'Photo only',
      url: 'https://cdn.example/photo.jpg',
    },
  ]

  for (let i = 0; i < 25; i += 1) {
    entries.push({
      ext: 'mp4',
      height: 720 + i,
      id: `video-${i}`,
      title: `Video ${i}`,
      url: `https://cdn.example/video-${i}.mp4`,
      vcodec: 'h264',
    })
  }

  entries.push({
    ext: 'mp4',
    id: 'duplicate',
    title: 'Duplicate',
    url: 'https://cdn.example/video-0.mp4',
    vcodec: 'h264',
  })

  const videos = collectVideoItems({ entries, title: 'Root' }, { maxItems: 20 })

  assert.equal(videos.length, 20)
  assert.equal(videos[0].id, 'video-0')
  assert.equal(videos[19].id, 'video-19')
  assert.ok(videos.every((video) => video.ext === 'mp4'))
})

test('collectVideoItems chooses the best video format for an entry', () => {
  const videos = collectVideoItems({
    entries: [
      {
        formats: [
          { ext: 'mp4', height: 360, url: 'https://cdn.example/360.mp4', vcodec: 'h264' },
          { ext: 'mp4', height: 1080, url: 'https://cdn.example/1080.mp4', vcodec: 'h264' },
        ],
        id: 'clip',
        title: 'Clip',
      },
    ],
  })

  assert.equal(videos.length, 1)
  assert.equal(videos[0].url, 'https://cdn.example/1080.mp4')
})

test('filename helpers sanitize unsafe characters', () => {
  const video = {
    ext: 'mp4',
    id: 'abc',
    index: 3,
    title: 'Bad <name>:"/\\|?*',
    url: 'https://cdn.example/video.mp4',
  }

  const name = filenameForVideo(video, { includeIndex: true })
  assert.match(name, /^03-/)
  assert.equal(/[<>:"/\\|?*]/.test(name), false)
  assert.match(name, /\.mp4$/)
  assert.match(zipFilename([video]), /-videos\.zip$/)
})
