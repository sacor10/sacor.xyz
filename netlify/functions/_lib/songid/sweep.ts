import { withSampleRate, type WavInfo } from '../../../../src/lib/songid/wav'
import type { IdentifyOutcome, RecognitionProvider } from './types'

/**
 * Rate factors to try, most-likely first. Slowed edits dominate, so the
 * speed-up factors that undo them (1.25 undoes an 0.8× slow) come before the
 * slow-down factors that undo sped-up/nightcore edits.
 */
export const SWEEP_FACTORS = [1.0, 1.25, 1.15, 1.33, 1.1, 0.9, 0.8] as const

export interface SweepDeps {
  provider: RecognitionProvider
  /**
   * Reserves one provider call against the global monthly budget. Returning
   * false stops the sweep — a lookup can never blow past the cost ceiling.
   */
  reserveCall(): Promise<boolean>
}

export interface SweepResult {
  outcome: IdentifyOutcome
  /** True when the monthly cap cut the sweep short (or prevented it entirely). */
  capExhausted: boolean
}

export async function runSpeedSweep(
  clip: Uint8Array,
  info: WavInfo,
  maxAttempts: number,
  { provider, reserveCall }: SweepDeps,
): Promise<SweepResult> {
  const factors = SWEEP_FACTORS.slice(0, Math.min(Math.max(1, maxAttempts), SWEEP_FACTORS.length))
  let attemptsUsed = 0
  for (const factor of factors) {
    if (!(await reserveCall())) {
      return { outcome: { status: 'no_match', attemptsUsed }, capExhausted: true }
    }
    const attempt = factor === 1 ? clip : withSampleRate(clip, info, Math.round(info.sampleRate * factor))
    attemptsUsed++
    const match = await provider.recognize(attempt)
    if (match) {
      return {
        outcome: { status: 'match', attemptsUsed, matchedFactor: factor, result: match },
        capExhausted: false,
      }
    }
  }
  return { outcome: { status: 'no_match', attemptsUsed }, capExhausted: false }
}
