import { readConfig } from './config.js'
import { createApp } from './server.js'

const config = readConfig()
const app = createApp({ config })

app.listen(config.port, () => {
  console.log(`Instagram downloader API listening on http://localhost:${config.port}`)
})
