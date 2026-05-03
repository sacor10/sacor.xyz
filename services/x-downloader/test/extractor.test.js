import assert from 'node:assert/strict'
import test from 'node:test'
import { collectVideoItems, filenameForVideo, zipFilename } from '../src/extractor.js'

test('collectVideoItems picks best video candidates and skips image-only entries', () => {
  const videos = collectVideoItems({
    title: 'Launch Post',
    entries: [
      {
        id: 'image-only',
        formats: [
          { ext: 'jpg', url: 'https://pbs.twimg.com/media/image.jpg' },
        ],
      },
      {
        id: 'video',
        title: 'Launch Clip',
        webpage_url: 'https://x.com/example/status/123',
        formats: [
          {
            acodec: 'none',
            ext: 'mp4',
            height: 360,
            url: 'https://video.twimg.com/low.mp4',
            vcodec: 'h264',
          },
          {
            acodec: 'aac',
            ext: 'mp4',
            height: 720,
            url: 'https://video.twimg.com/high.mp4',
            vcodec: 'h264',
          },
        ],
      },
    ],
  })

  assert.equal(videos.length, 1)
  assert.equal(videos[0].title, 'Launch Clip')
  assert.equal(videos[0].url, 'https://video.twimg.com/high.mp4')
})

test('collectVideoItems caps results at maxItems and de-duplicates media URLs', () => {
  const videos = collectVideoItems({
    title: 'Multi Post',
    entries: [
      { id: 'one', ext: 'mp4', url: 'https://video.twimg.com/one.mp4', vcodec: 'h264' },
      { id: 'dupe', ext: 'mp4', url: 'https://video.twimg.com/one.mp4', vcodec: 'h264' },
      { id: 'two', ext: 'mp4', url: 'https://video.twimg.com/two.mp4', vcodec: 'h264' },
      { id: 'three', ext: 'mp4', url: 'https://video.twimg.com/three.mp4', vcodec: 'h264' },
    ],
  }, { maxItems: 2 })

  assert.deepEqual(videos.map((video) => video.id), ['one', 'two'])
})

test('collectVideoItems ignores HLS playlists and image-only posts', () => {
  const videos = collectVideoItems({
    title: 'No Videos',
    formats: [
      {
        ext: 'mp4',
        protocol: 'm3u8_native',
        url: 'https://video.twimg.com/playlist.m3u8',
        vcodec: 'h264',
      },
      {
        ext: 'png',
        url: 'https://pbs.twimg.com/media/image.png',
      },
    ],
  })

  assert.deepEqual(videos, [])
})

test('filename helpers sanitize titles and normalize downloads to MP4', () => {
  assert.equal(
    filenameForVideo({ ext: 'mkv', index: 2, title: 'bad:/name?* clip' }, { includeIndex: true }),
    '02-badname clip.mp4',
  )

  assert.equal(
    zipFilename([{ title: 'multi:/name?* clip' }]),
    'multiname clip-videos.zip',
  )
})
