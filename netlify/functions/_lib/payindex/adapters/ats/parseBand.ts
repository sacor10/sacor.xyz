// Pure pay-band text parser shared by the ATS adapters whose platform
// doesn't expose a structured salary field (Greenhouse and Workday embed
// pay bands in free-text job description HTML; Lever/Ashby usually don't
// need this at all). Deliberately conservative: a posting this can't
// confidently parse becomes an honest gap (a lower observation count), but
// a false-positive parse would silently corrupt a cell's median — so when
// in doubt, this returns null.

export interface ParsedBand {
  readonly min: number
  readonly max: number
  readonly basis: 'hourly' | 'annual'
}

const REJECT_CONTEXT = /\b(equity|rsu|stock option|sign[- ]?on bonus|signing bonus|target bonus|bonus potential|relocation)\b/i

const RANGE_PATTERN =
  /\$\s*([\d,]+(?:\.\d+)?)\s*(k)?\s*(?:-|–|—|to)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(k)?\s*(per\s*hour|\/\s*hr|hourly|per\s*year|annually|\/\s*yr|a\s*year)?/gi

function parseNumber(raw: string, isK: boolean): number {
  const n = Number(raw.replace(/,/g, ''))
  return isK ? n * 1000 : n
}

function inferBasis(unitHint: string | undefined, context: string): 'hourly' | 'annual' {
  const hint = (unitHint ?? '').toLowerCase()
  if (hint.includes('hour') || hint.includes('/hr') || hint.includes('hr')) return 'hourly'
  if (/\bhourly\b/i.test(context) && !/\bannual/i.test(context)) return 'hourly'
  return 'annual'
}

function isSane(band: ParsedBand): boolean {
  if (band.max < band.min) return false
  if (band.min <= 0) return false
  if (band.max / band.min > 5) return false // e.g. "$1 - $500,000" garbage matches
  if (band.basis === 'hourly') return band.min >= 7 && band.max <= 500
  return band.min >= 10_000 && band.max <= 2_000_000
}

// Returns the first sane, non-rejected band found, or null. Only ever
// returns ONE band per call — callers pass one posting's text at a time.
export function parsePayBand(text: string): ParsedBand | null {
  if (!text) return null
  RANGE_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = RANGE_PATTERN.exec(text)) !== null) {
    const [full, rawMin, minK, rawMax, maxK, unitHint] = match
    const contextStart = Math.max(0, match.index - 40)
    const contextEnd = Math.min(text.length, match.index + full.length + 40)
    const context = text.slice(contextStart, contextEnd)

    if (REJECT_CONTEXT.test(context)) continue

    const min = parseNumber(rawMin, Boolean(minK))
    const max = parseNumber(rawMax, Boolean(maxK))
    const basis = inferBasis(unitHint, context)
    const band: ParsedBand = { min, max, basis }

    if (isSane(band)) return band
  }

  return null
}
