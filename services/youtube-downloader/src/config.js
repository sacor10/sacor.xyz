const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8888',
  'http://127.0.0.1:8888',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://sacor.xyz',
  'https://www.sacor.xyz',
]

function readInteger(value, fallback, { min = 1 } = {}) {
  const number = Number.parseInt(value, 10)
  if (!Number.isFinite(number) || number < min) return fallback
  return number
}

function readOrigins(value) {
  if (!value) return DEFAULT_ORIGINS
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function readConfig(env = process.env) {
  return {
    allowedOrigins: readOrigins(env.SITE_ORIGINS),
    extractTimeoutMs: readInteger(env.EXTRACT_TIMEOUT_MS, 30000),
    maxItems: readInteger(env.MAX_ITEMS, 20),
    maxVideoBytes: readInteger(env.MAX_VIDEO_BYTES, 500 * 1024 * 1024),
    mediaTimeoutMs: readInteger(env.MEDIA_TIMEOUT_MS, 30000),
    port: readInteger(env.PORT, 8789),
  }
}
