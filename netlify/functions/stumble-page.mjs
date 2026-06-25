import {
  getPagesStore,
  loadApprovedIndex,
  loadPageCard,
  findSummaryBySlug,
  json,
} from './_lib/stumble.mjs'

// GET /stumble-page?slug=<slug>  (or ?id=<pageId>)
//
// Resolve a single approved page so that refreshing or directly opening
// /stumble/<slug> lands on THAT page instead of randomizing. Public, no
// session needed — pages are visible to everyone. Returns { page: null } when
// the slug/id doesn't match an approved page, letting the client fall back to a
// fresh stumble rather than erroring.
export default async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const slug = url.searchParams.get('slug')
  const pagesStore = getPagesStore()

  if (id) {
    return json({ page: await loadPageCard(pagesStore, id) })
  }

  if (!slug) return json({ page: null })

  const index = await loadApprovedIndex(pagesStore)
  const match = findSummaryBySlug(index, slug)
  if (!match) return json({ page: null })

  return json({ page: await loadPageCard(pagesStore, match.id) })
}
