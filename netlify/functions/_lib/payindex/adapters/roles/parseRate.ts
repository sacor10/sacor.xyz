// Single-figure rate parser for Tier C sources that publish one rate per
// row/classification (union wage scales, salary schedule steps, carrier
// pay pages) rather than a min-max range. Same conservative philosophy as
// ats/parseBand.ts: reject on ambiguous context or an out-of-sane-range
// figure rather than guess.

export interface ParsedRate {
  readonly value: number
  readonly basis: 'hourly' | 'annual'
}

const REJECT_CONTEXT = /\b(equity|rsu|stock option|sign[- ]?on bonus|signing bonus|target bonus|bonus potential|relocation)\b/i

const RATE_PATTERN = /\$\s*([\d,]+(?:\.\d+)?)\s*(k)?\s*(per\s*hour|\/\s*hr|hourly|per\s*year|annually|\/\s*yr|a\s*year)?/gi

function isSane(rate: ParsedRate): boolean {
  if (rate.value <= 0) return false
  if (rate.basis === 'hourly') return rate.value >= 7 && rate.value <= 500
  return rate.value >= 10_000 && rate.value <= 2_000_000
}

// defaultBasis applies only when the text has no "per hour"/"annually"-style
// unit hint at all — most union scale pages are implicitly hourly, most
// salary schedules are implicitly annual, so callers pass the right default
// for their source rather than this guessing.
export function parseSingleRate(text: string, defaultBasis: 'hourly' | 'annual'): ParsedRate | null {
  if (!text) return null
  RATE_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = RATE_PATTERN.exec(text)) !== null) {
    const [full, raw, k, unitHint] = match
    const contextStart = Math.max(0, match.index - 40)
    const contextEnd = Math.min(text.length, match.index + full.length + 40)
    const context = text.slice(contextStart, contextEnd)
    if (REJECT_CONTEXT.test(context)) continue

    const value = Number(raw.replace(/,/g, '')) * (k ? 1000 : 1)
    const hint = (unitHint ?? '').toLowerCase()
    const basis: 'hourly' | 'annual' = hint.includes('hour') || hint.includes('hr') ? 'hourly' : defaultBasis
    const rate: ParsedRate = { value, basis }
    if (isSane(rate)) return rate
  }

  return null
}
