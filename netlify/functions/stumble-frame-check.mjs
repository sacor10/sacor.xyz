import { canonicalizeUrl, domainOf, json } from './_lib/stumble.mjs'

// GET /stumble-frame-check?url=<encoded url>
//
// Probe a URL server-side and report whether the /stumble iframe can actually
// display it — and if not, the specific reason. The browser can't read why a
// cross-origin frame failed (X-Frame-Options/CSP blocking still fires the
// iframe's onLoad, leaving the user staring at Chrome's raw "refused to connect"
// page), so StumbleFrame relies on this probe as the source of truth.
//
// Returns { ok: true } when the site should frame fine, or
// { ok: false, reason, message, status? } describing why it won't. Fails OPEN:
// any unexpected error returns ok:true so a probe bug never hides a site that
// would actually load. Public, no session needed; cached at the edge since the
// answer is the same for every visitor and rarely changes.

const PROBE_TIMEOUT_MS = 6000

// A real desktop browser UA — some sites vary framing headers (or block
// entirely) for unknown clients.
const PROBE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Pull a single directive (e.g. "frame-ancestors") out of a CSP header value.
// Returns the lowercased source list, or null if the directive is absent.
function cspDirective(csp, name) {
  for (const part of String(csp || '').split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const sp = trimmed.indexOf(' ')
    const directive = (sp === -1 ? trimmed : trimmed.slice(0, sp)).toLowerCase()
    if (directive === name) {
      return sp === -1 ? '' : trimmed.slice(sp + 1).trim().toLowerCase()
    }
  }
  return null
}

// Decide whether a `frame-ancestors` source list lets `ourOrigin` embed the
// page. Conservative: only report a block when the list clearly excludes us, so
// we don't hide a site that would actually frame.
function frameAncestorsBlocks(sources, ourOrigin) {
  const list = sources.split(/\s+/).filter(Boolean)
  if (list.length === 0) return false
  if (list.includes("'none'")) return true
  const host = ourOrigin.toLowerCase()
  for (const src of list) {
    if (src === "'self'") continue // self = the target's own origin, never us
    // Bare host/scheme source (quoted keywords like 'unsafe-inline' don't apply
    // here). Match our full origin against it, allowing a wildcard scheme.
    const normalized = src.replace(/^https?:\/\//, '')
    if (host.endsWith(normalized) || host.replace(/^https?:\/\//, '') === normalized) {
      return false
    }
  }
  return true
}

export default async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })

  const reqUrl = new URL(req.url)
  const target = canonicalizeUrl(reqUrl.searchParams.get('url'))
  if (!target) return json({ error: 'invalid url' }, { status: 400 })

  const domain = domainOf(target) || target
  const ourOrigin = reqUrl.origin
  // Cache the verdict at the edge — it's identical for every visitor and frame
  // policy rarely changes. Keeps the per-stumble probe effectively free.
  const headers = { 'Cache-Control': 'public, max-age=86400' }

  let res
  try {
    res = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: {
        'User-Agent': PROBE_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
  } catch (err) {
    const reason = err?.name === 'TimeoutError' ? 'timeout' : 'unreachable'
    const message =
      reason === 'timeout'
        ? `${domain} took too long to respond.`
        : `${domain} couldn’t be reached.`
    return json({ ok: false, reason, message }, { headers })
  }

  if (res.status >= 400) {
    return json(
      {
        ok: false,
        reason: 'http-error',
        status: res.status,
        message: `${domain} returned HTTP ${res.status}.`,
      },
      { headers },
    )
  }

  const xfo = (res.headers.get('x-frame-options') || '').trim().toLowerCase()
  if (xfo === 'deny' || xfo === 'sameorigin' || xfo.startsWith('allow-from')) {
    return json(
      {
        ok: false,
        reason: 'x-frame-options',
        message: `${domain} blocks embedded browsing (X-Frame-Options).`,
      },
      { headers },
    )
  }

  const frameAncestors = cspDirective(res.headers.get('content-security-policy'), 'frame-ancestors')
  if (frameAncestors !== null && frameAncestorsBlocks(frameAncestors, ourOrigin)) {
    return json(
      {
        ok: false,
        reason: 'csp',
        message: `${domain} blocks embedded browsing (Content-Security-Policy).`,
      },
      { headers },
    )
  }

  return json({ ok: true }, { headers })
}
