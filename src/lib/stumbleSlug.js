// Canonical "site name" slug for a stumble page's URL (/stumble/<slug>).
//
// Shared by the frontend (which writes the slug into the address bar after each
// stumble) and the Netlify Functions (which store it on each index summary so a
// slug can be resolved back to a specific page on refresh / direct navigation).
// Keep this the single source of truth — if the two sides drift, refreshing a
// /stumble/<slug> URL would resolve to the wrong page or none at all.

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function siteSlug(page) {
  const source = String(page?.title || domainOf(page?.url || '') || 'site').trim()
  const slug = source
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // strip combining diacritics (Café -> Cafe)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || 'site'
}
