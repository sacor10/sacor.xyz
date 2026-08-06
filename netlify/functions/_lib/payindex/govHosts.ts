// Methodology rule 9: no government data, anywhere in the pipeline. This is
// the single shared check for that rule — used both by the HTTP layer
// (http.ts, which refuses to fetch a matching host at all) and by
// tests/payindex/sources.test.ts, which statically scans every configured
// source URL so a banned host can never even be added to the registry.

const GOVERNMENT_HOST_PATTERNS: RegExp[] = [
  /\.gov$/i,
  /\.mil$/i,
  /\.gov\./i, // e.g. ons.gov.uk-style — not currently used but guarded anyway
  /\.state\.[a-z]{2}\.us$/i,
  /\.k12\.[a-z]{2}\.us$/i,
  /(^|\.)census\.gov$/i,
  /(^|\.)bls\.gov$/i,
  /(^|\.)data\.gov$/i,
  /(^|\.)dol\.gov$/i,
]

export function isGovernmentHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return GOVERNMENT_HOST_PATTERNS.some((pattern) => pattern.test(host))
}

export function isGovernmentUrl(url: string): boolean {
  try {
    return isGovernmentHost(new URL(url).hostname)
  } catch {
    // Not a parseable absolute URL — callers should treat this as invalid
    // input separately; this guard only judges hosts it can actually read.
    return false
  }
}
