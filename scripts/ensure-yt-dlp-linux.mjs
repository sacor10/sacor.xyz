import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'

const TARGET_DIR = path.join(process.cwd(), 'netlify', 'bin')
const TARGET_PATH = path.join(TARGET_DIR, 'yt-dlp_linux')
const DOWNLOAD_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux'

function get(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'sacor.xyz-netlify-build',
      },
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume()
        if (redirects >= 5) {
          reject(new Error('Too many redirects downloading yt-dlp_linux.'))
          return
        }
        resolve(get(new URL(response.headers.location, url).toString(), redirects + 1))
        return
      }

      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`yt-dlp_linux download failed with HTTP ${response.statusCode}.`))
        return
      }

      resolve(response)
    }).on('error', reject)
  })
}

await fs.promises.mkdir(TARGET_DIR, { recursive: true })

if (!fs.existsSync(TARGET_PATH) || fs.statSync(TARGET_PATH).size < 1024 * 1024) {
  const tmpPath = `${TARGET_PATH}.tmp`
  await pipeline(await get(DOWNLOAD_URL), fs.createWriteStream(tmpPath))
  await fs.promises.rename(tmpPath, TARGET_PATH)
}

await fs.promises.chmod(TARGET_PATH, 0o755)
console.log(`yt-dlp_linux ready at ${TARGET_PATH}`)
