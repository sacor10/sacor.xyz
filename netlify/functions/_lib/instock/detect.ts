import type { DetectionResult, DetectionSource, MatchRule } from './types'

/**
 * Availability detection for an arbitrary product page, from HTML alone.
 *
 * Three tiers, most trustworthy first:
 *
 *   1. The page's JSON-LD Product offers, scoped to the product being watched.
 *      This is the only tier that knows which product a signal belongs to, so
 *      it is the only one that can ignore the "you may also like" carousel.
 *   2. A whole-page sweep of commerce JSON (schema.org availability values and
 *      the inStock/soldOut booleans shipped for hydration). No product scoping,
 *      so out-of-stock signals win ties here.
 *   3. Stock phrases in the visible copy ("add to cart" vs. "sold out"), again
 *      with out-of-stock winning ties.
 *
 * The tie-break asymmetry is deliberate for tiers 2 and 3: a sold-out page very
 * often still carries a hidden "Add to cart" button in its markup, while a
 * genuinely purchasable page almost never says "sold out". A late alert costs
 * you a few minutes; an eager one costs a wasted sprint to checkout. Tier 1
 * does not need that caution — once offers are scoped to the right product, any
 * purchasable offer really does mean you can buy it.
 */

/** Undo the JSON string escaping used inside <script> payloads. */
const unescapeEmbeddedJson = (html: string): string =>
  html
    .replace(/\\u0026/gi, '&')
    .replace(/\\u002f/gi, '/')
    .replace(/\\u0022/gi, '"')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/')

/**
 * BackOrder sits with the out-of-stock tokens on purpose: unlike PreOrder,
 * which means "you can buy it now, it ships later", a back-order usually means
 * the checkout is closed until the restock actually lands.
 */
const OUT_TOKENS = ['outofstock', 'soldout', 'discontinued', 'nolongeravailable', 'backorder']
const IN_TOKENS = ['instock', 'preorder', 'onlineonly', 'limitedavailability', 'instoreonly']

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

const summarize = (signals: string[], limit = 4): string =>
  signals.slice(0, limit).join(', ') + (signals.length > limit ? `, +${signals.length - limit} more` : '')

const classifyToken = (raw: string): 'in' | 'out' | null => {
  const token = raw.toLowerCase().replace(/[^a-z]/g, '')
  if (!token) return null
  // Checked before the in-stock list so "outofstock" is never read as "instock".
  if (OUT_TOKENS.some((t) => token.includes(t))) return 'out'
  if (IN_TOKENS.some((t) => token.includes(t))) return 'in'
  return null
}

// --- Tier 1: JSON-LD, scoped to the watched product ------------------------

type JsonObject = Record<string, unknown>

interface Candidate {
  node: JsonObject
  /** True when we reached this node through a recommendation/related list. */
  related: boolean
}

const LD_SCRIPT_RE = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

/** Keys that lead to the same product (variants, page main entity). */
const SAME_PRODUCT_KEYS = ['@graph', 'mainEntity', 'mainEntityOfPage', 'hasVariant', 'isVariantOf']
/** Keys that lead to other products — carousels, cross-sells, breadcrumbs. */
const RELATED_KEYS = ['itemListElement', 'item', 'isRelatedTo', 'isSimilarTo', 'isAccessoryOrSparePartFor']

const decodeEntities = (text: string): string =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

const parseLdBlocks = (html: string): unknown[] => {
  const parsed: unknown[] = []
  for (const match of html.matchAll(LD_SCRIPT_RE)) {
    const raw = match[1].trim()
    if (!raw) continue
    try {
      parsed.push(JSON.parse(raw))
    } catch {
      // Some CMSs HTML-escape the payload; retry once before giving up.
      try {
        parsed.push(JSON.parse(decodeEntities(raw)))
      } catch {
        /* not our problem — the whole-page sweep still gets a look */
      }
    }
  }
  return parsed
}

const collectNodes = (value: unknown, out: Candidate[], related: boolean, depth: number): void => {
  if (depth > 10 || value === null || typeof value !== 'object') return

  if (Array.isArray(value)) {
    for (const entry of value) collectNodes(entry, out, related, depth + 1)
    return
  }

  const node = value as JsonObject
  out.push({ node, related })
  for (const key of SAME_PRODUCT_KEYS) {
    if (key in node) collectNodes(node[key], out, related, depth + 1)
  }
  for (const key of RELATED_KEYS) {
    if (key in node) collectNodes(node[key], out, true, depth + 1)
  }
}

const typesOf = (node: JsonObject): string[] => {
  const raw = node['@type']
  const list = Array.isArray(raw) ? raw : [raw]
  return list.filter((t): t is string => typeof t === 'string').map((t) => t.toLowerCase())
}

const isProduct = (node: JsonObject): boolean =>
  typesOf(node).some((type) => type.includes('product') || type === 'vehicle' || type === 'book')

/** Flattens Offer / AggregateOffer / arrays into a plain list of offer nodes. */
const offersOf = (node: JsonObject): JsonObject[] => {
  const found: JsonObject[] = []
  const walk = (value: unknown, depth: number): void => {
    if (depth > 4 || value === null || typeof value !== 'object') return
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry, depth + 1)
      return
    }
    const offer = value as JsonObject
    found.push(offer)
    if ('offers' in offer) walk(offer.offers, depth + 1)
  }
  walk(node.offers, 0)
  return found
}

const availabilityOf = (offer: JsonObject): string | null => {
  const raw = offer.availability ?? offer.availabilityStatus
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const id = (raw as JsonObject)['@id'] ?? (raw as JsonObject).name
    if (typeof id === 'string') return id
  }
  return null
}

/** Loose URL identity: ignores scheme, "www.", trailing slash, query and hash. */
const urlIdentity = (value: string): string | null => {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const path = url.pathname.replace(/\/+$/, '').toLowerCase()
    return `${host}${path}`
  } catch {
    return null
  }
}

const sameProductUrl = (candidate: unknown, pageUrl: string): boolean => {
  if (typeof candidate !== 'string' || !pageUrl) return false
  const a = urlIdentity(candidate)
  const b = urlIdentity(pageUrl)
  return !!a && !!b && a === b
}

/**
 * Reads availability from the page's own Product markup. Returns null when
 * there is no usable Product node, or when the page describes several unrelated
 * products and none of them is identifiable as the watched one — guessing there
 * is exactly how a recommendation carousel produces a false alert.
 */
const scanProductLd = (html: string, pageUrl: string): DetectionResult | null => {
  const candidates: Candidate[] = []
  for (const block of parseLdBlocks(html)) collectNodes(block, candidates, false, 0)

  const products = candidates
    .filter(({ node, related }) => !related && isProduct(node))
    .map(({ node }) => ({ node, offers: offersOf(node).filter((offer) => availabilityOf(offer) !== null) }))
    .filter(({ offers }) => offers.length > 0)

  if (products.length === 0) return null

  // A url match pins the watched product exactly; without one we fall back to
  // every non-related Product, which is still carousel-free.
  const matched = products.filter(({ node }) => sameProductUrl(node.url, pageUrl))
  const selected = matched.length > 0 ? matched : products
  const scoped = matched.length > 0

  const verdict: Verdict = { in: [], out: [] }
  for (const { offers } of selected) {
    for (const offer of offers) {
      const value = availabilityOf(offer) as string
      const kind = classifyToken(value)
      if (kind) verdict[kind].push(`offer availability=${value.split('/').pop()}`)
    }
  }

  if (verdict.in.length === 0 && verdict.out.length === 0) return null

  const where = scoped ? 'this product' : `the page's product markup (${selected.length} product node(s))`
  // Any purchasable offer for the right product means you can buy it, so
  // in-stock wins here — the opposite of the unscoped tiers below.
  if (verdict.in.length > 0) {
    return {
      status: 'in_stock',
      reason: `${where} is listed as available (${summarize(verdict.in)})`,
      signals: [...verdict.in, ...verdict.out],
      source: 'product',
    }
  }

  return {
    status: 'out_of_stock',
    reason: `${where} is listed as unavailable (${summarize(verdict.out)})`,
    signals: verdict.out,
    source: 'product',
  }
}

// --- Tier 2: whole-page commerce JSON --------------------------------------

const scanStructured = (haystack: string): Verdict => {
  const verdict: Verdict = { in: [], out: [] }

  for (const match of haystack.matchAll(AVAILABILITY_RE)) {
    const kind = classifyToken(match[1])
    if (kind) verdict[kind].push(`availability=${match[1].trim().split('/').pop()}`)
  }

  for (const match of haystack.matchAll(IN_FLAG_RE)) {
    ;(match[2] === 'true' ? verdict.in : verdict.out).push(`${match[1]}=${match[2]}`)
  }

  for (const match of haystack.matchAll(OUT_FLAG_RE)) {
    ;(match[2] === 'true' ? verdict.out : verdict.in).push(`${match[1]}=${match[2]}`)
  }

  return verdict
}

// --- Tier 3: visible copy ---------------------------------------------------

const scanPhrases = (haystack: string): Verdict => ({
  out: OUT_PHRASES.filter((phrase) => haystack.includes(phrase)).map((p) => `"${p}"`),
  in: IN_PHRASES.filter((phrase) => haystack.includes(phrase)).map((p) => `"${p}"`),
})

const unscoped = (verdict: Verdict, source: DetectionSource, label: string): DetectionResult | null => {
  if (verdict.out.length > 0) {
    return {
      status: 'out_of_stock',
      reason: `${label} says unavailable (${summarize(verdict.out)})`,
      signals: [...verdict.out, ...verdict.in],
      source,
    }
  }
  if (verdict.in.length > 0) {
    return {
      status: 'in_stock',
      reason: `${label} says available (${summarize(verdict.in)})`,
      signals: verdict.in,
      source,
    }
  }
  return null
}

export function detectAvailability(html: string, rule: MatchRule, pageUrl = ''): DetectionResult {
  const raw = String(html ?? '')

  if (rule.mode === 'contains' || rule.mode === 'absent') {
    const needle = rule.text.trim().toLowerCase()
    if (!needle) {
      return { status: 'unknown', reason: 'Custom rule has no text to match', signals: [], source: 'none' }
    }
    const present = unescapeEmbeddedJson(raw).toLowerCase().includes(needle)
    const wantPresent = rule.mode === 'contains'
    const signal = `${present ? 'found' : 'missing'}: "${rule.text.trim()}"`
    return {
      status: present === wantPresent ? 'in_stock' : 'out_of_stock',
      reason: signal,
      signals: [signal],
      source: 'rule',
    }
  }

  const scoped = scanProductLd(raw, pageUrl)
  if (scoped) return scoped

  const haystack = unescapeEmbeddedJson(raw).toLowerCase()

  return (
    unscoped(scanStructured(haystack), 'page', 'Page data') ??
    unscoped(scanPhrases(haystack), 'phrases', 'Page copy') ?? {
      status: 'unknown',
      reason: 'No stock signal found — try a custom "contains"/"absent" rule',
      signals: [],
      source: 'none',
    }
  )
}
