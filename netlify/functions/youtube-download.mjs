import { extractYouTubeVideos, filenameForVideo } from '../../services/youtube-downloader/src/extractor.js'
import { DownloaderError, NoVideosError } from '../../services/youtube-downloader/src/errors.js'
import { validateYouTubeUrl } from '../../services/youtube-downloader/src/youtube.js'

const EXTRACT_TIMEOUT_MS = 25000

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })

const errorBody = (code, message, status) => json({ code, message }, status)

function toJsonError(error) {
  if (error instanceof DownloaderError) {
    return errorBody(error.code, error.message, error.status)
  }
  return errorBody('internal_error', 'The YouTube downloader failed unexpectedly.', 500)
}

export default async (req) => {
  if (req.method !== 'POST') {
    return errorBody('method_not_allowed', 'Use POST.', 405)
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return errorBody('invalid_json', 'Request body must be valid JSON.', 400)
  }

  try {
    const target = validateYouTubeUrl(payload?.url)
    const videos = await extractYouTubeVideos(target.href, {
      maxItems: 1,
      timeoutMs: EXTRACT_TIMEOUT_MS,
    })

    if (!Array.isArray(videos) || videos.length === 0) throw new NoVideosError()

    return json({
      videos: videos.slice(0, 1).map((video) => ({
        url: video.url,
        filename: filenameForVideo(video),
        width: video.width,
        height: video.height,
      })),
    })
  } catch (error) {
    return toJsonError(error)
  }
}
