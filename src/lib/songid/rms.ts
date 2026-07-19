// Picks the most music-dense window of a mono PCM track: the first seconds of
// a clip are often silence or speech, so always analyzing from t=0 wastes the
// one shot at the fingerprint API.

export interface WindowPick {
  /** Sample index where the chosen window starts. */
  start: number
  /** Window length in samples (may be the whole track when it's short). */
  length: number
}

const rmsOf = (samples: Int16Array, start: number, end: number): number => {
  let sum = 0
  for (let i = start; i < end; i++) sum += samples[i] * samples[i]
  return Math.sqrt(sum / Math.max(1, end - start))
}

/**
 * Slides a window over the track (1s hop) and scores each position by the RMS
 * of its 1s sub-blocks: half the mean, half the 25th percentile. The
 * percentile term rewards *sustained* loudness, so a single transient (a slam,
 * a shout) can't beat a window of continuous music.
 */
export function pickBestWindow(
  samples: Int16Array,
  sampleRate: number,
  windowSeconds = 12,
  hopSeconds = 1,
): WindowPick {
  const windowLength = Math.floor(windowSeconds * sampleRate)
  if (samples.length <= windowLength) return { start: 0, length: samples.length }

  const block = Math.floor(sampleRate) // 1s sub-blocks
  const blockRms: number[] = []
  for (let start = 0; start + block <= samples.length; start += block) {
    blockRms.push(rmsOf(samples, start, start + block))
  }

  const blocksPerWindow = Math.floor(windowSeconds)
  const hopBlocks = Math.max(1, Math.floor(hopSeconds))
  let bestScore = -1
  let bestBlock = 0
  for (let b = 0; b + blocksPerWindow <= blockRms.length; b += hopBlocks) {
    const window = blockRms.slice(b, b + blocksPerWindow)
    const sorted = [...window].sort((x, y) => x - y)
    const mean = window.reduce((acc, v) => acc + v, 0) / window.length
    const p25 = sorted[Math.floor(sorted.length * 0.25)]
    const score = 0.5 * mean + 0.5 * p25
    if (score > bestScore) {
      bestScore = score
      bestBlock = b
    }
  }

  const start = Math.min(bestBlock * block, samples.length - windowLength)
  return { start, length: windowLength }
}
