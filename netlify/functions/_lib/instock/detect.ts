import type { DetectionResult, MatchRule } from './types'

/**
 * Availability detection for an arbitrary product page, from HTML alone.
 *
 * Retail pages are client-rendered these days, so the reliable signal is not
 * the visible copy but the commerce JSON the page ships for hydration
 * (schema.org Product offers, __NEXT_DATA__, Apollo caches...). We read that
 * first and fall back to stock phrases only when there is nothing structured.
 *
 * Out-of-stock signals beat in-stock signals on purpose: a sold-out page very
 * often still carries a hidden "Add to cart" button in its markup, while a
 * genuinely purchasable page almost never says "sold out". Being conservative
 * costs a slightly later alert; being eager costs a wasted sprint to checkout.
 */

/** Undo the JSON string escaping used inside <script> payloads. */
const unescapeEmbeddedJson = (html: string): string =>
  html
    .replace(/\\u0026/gi, '&')
    .replace(/\\u002f/gi, '/')
    .replace(/\\u0022/gi, '"')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')

const OUT_TOKENS = ['outofstock', 'soldout', 'discontinued', 'nolongeravailable']
const IN_TOKENS = ['instock', 'preorder', 'backorder', 'onlineonly', 'limitedavailability']

const AVAILABILITY_RE = /"availability"\s*:\s*"?([a-z0-9_:/.\- ]{2,60})"?/g
const IN_FLAG_RE = /"(instock|isinstock|isavailable|purchasable|ispurchasable|addtocartenabled)"\s*:\s*(true|false)/g
const OUT_FLAG_RE = /"(soldout|issoldout|outofstock|isoutofstock|isbackorder(?:ed)?)"\s*:\s*(true|false)/g

const OUT_PHRASES = [
  'sold out',
  'out of stock',
  'out-of-stock',
  'currently unavailable',
  'temporarily unavailable',
  'no longer available',
  'not available',
  'notify me when',
  'email me when available',
  'coming soon',
]

const IN_PHRASES = [
  'add to cart',
  'add to bag',
  'add to basket',
  'buy now',
  'in stock',
  'pre-order now',
  'proceed to checkout',
  'available now',
]

interface Verdict {
  in: string[]
  out: string[]
}

const scanStructured = (haystack: string): Verdict => {
  const verdict: Verdict = { in: [], out: [] }

  for (const match of haystack.matchAll(AVAILABILITY_RE)) {
    const token = match[1].replace(/[^a-z]/g, '')
    const out = OUT_TOKENS.find((t) => token.includes(t))
    if (out) {
      verdict.out.push(`availability=${out}`)
      continue
    }
    const inStock = IN_TOKENS.find((t) => token.includes(t))
    if (inStock) verdict.in.push(`availability=${inStock}`)
  }

  for (const match of haystack.matchAll(IN_FLAG_RE)) {
    ;(match[2] === 'true' ? verdict.in : verdict.out).push(`${match[1]}=${match[2]}`)
  }

  for (const match of haystack.matchAll(OUT_FLAG_RE)) {
    ;(match[2] === 'true' ? verdict.out : verdict.in).push(`${match[1]}=${match[2]}`)
  }

  return verdict
}

const scanPhrases = (haystack: string): Verdict => ({
  out: OUT_PHRASES.filter((phrase) => haystack.includes(phrase)).map((p) => `"${p}"`),
  in: IN_PHRASES.filter((phrase) => haystack.includes(phrase)).map((p) => `"${p}"`),
})

const summarize = (signals: string[], limit = 4): string =>
  signals.slice(0, limit).join(', ') + (signals.length > limit ? `, +${signals.length - limit} more` : '')

export function detectAvailability(html: string, rule: MatchRule): DetectionResult {
  const haystack = unescapeEmbeddedJson(String(html ?? '')).toLowerCase()

  if (rule.mode === 'contains' || rule.mode === 'absent') {
    const needle = rule.text.trim().toLowerCase()
    if (!needle) {
      return { status: 'unknown', reason: 'Custom rule has no text to match', signals: [] }
    }
    const present = haystack.includes(needle)
    const wantPresent = rule.mode === 'contains'
    const signal = `${present ? 'found' : 'missing'}: "${rule.text.trim()}"`
    return {
      status: present === wantPresent ? 'in_stock' : 'out_of_stock',
      reason: signal,
      signals: [signal],
    }
  }

  const structured = scanStructured(haystack)
  if (structured.out.length > 0) {
    return {
      status: 'out_of_stock',
      reason: `Page data says unavailable (${summarize(structured.out)})`,
      signals: [...structured.out, ...structured.in],
    }
  }
  if (structured.in.length > 0) {
    return {
      status: 'in_stock',
      reason: `Page data says available (${summarize(structured.in)})`,
      signals: structured.in,
    }
  }

  const phrases = scanPhrases(haystack)
  if (phrases.out.length > 0) {
    return {
      status: 'out_of_stock',
      reason: `Page reads as unavailable (${summarize(phrases.out)})`,
      signals: [...phrases.out, ...phrases.in],
    }
  }
  if (phrases.in.length > 0) {
    return {
      status: 'in_stock',
      reason: `Page reads as available (${summarize(phrases.in)})`,
      signals: phrases.in,
    }
  }

  return {
    status: 'unknown',
    reason: 'No stock signal found — try a custom "contains"/"absent" rule',
    signals: [],
  }
}
