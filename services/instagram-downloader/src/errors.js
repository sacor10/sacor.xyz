export class DownloaderError extends Error {
  constructor(code, message, status = 500) {
    super(message)
    this.name = 'DownloaderError'
    this.code = code
    this.status = status
  }
}

export class NoVideosError extends DownloaderError {
  constructor() {
    super('no_videos', 'No public Instagram videos were found for that URL.', 404)
    this.name = 'NoVideosError'
  }
}
