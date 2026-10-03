import { createApp } from './server.js'

const PORT = parseInt(process.env.PORT, 10) || 5003

const app = createApp()

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[youtube-downloader] Self-hosted service listening on http://0.0.0.0:${PORT}`)
})
