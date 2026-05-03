export class DownloaderError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.name = 'DownloaderError'
    this.code = code
    this.status = status
  }
}

export class NoVideosError extends DownloaderError {
  constructor() {
    super('no_videos', 'No public X/Twitter videos were found for that URL.', 404)
    this.name = 'NoVideosError'
  }
}
