// Green Hill Zone Webring — the canonical member list, shared by the webring
// page (src/pages/WebringPage.jsx), the left-nav TOC, and the footer ring nav
// (both in src/Layout.jsx). Add new members here and everything stays in sync.

export const webringMembers = [
  {
    rank: 1,
    name: 'sacor.xyz',
    url: '/',
    external: false,
    desc: 'The site you are on right now! Home of Sacor, the youtube-link-to-mp4 downloader, and strong opinions.',
    status: 'ACTIVE',
    joined: 'Founded 1989 (retroactively)',
  },
  {
    rank: 2,
    name: "George's Vista",
    url: 'https://georgesvista.netlify.app/',
    external: true,
    desc: 'A brand new vista out on the wider web. The first fellow traveler to join the ring — go say hi and admire the view.',
    status: 'ACTIVE',
    joined: 'Joined 2026',
  },
]

// The prev/next neighbors of `currentUrl` in the ring, wrapping around the ends.
// The footer always renders on sacor pages, so currentUrl defaults to '/', but
// this stays correct as more members are added.
export function ringNeighbors(currentUrl = '/') {
  const idx = webringMembers.findIndex((m) => m.url === currentUrl)
  const i = idx === -1 ? 0 : idx
  const len = webringMembers.length
  return {
    prev: webringMembers[(i - 1 + len) % len],
    next: webringMembers[(i + 1) % len],
  }
}

// A random ring member, preferring not to send you back to where you already
// are. Falls back to the full list if excluding leaves nothing.
export function randomMember(excludeUrl) {
  const pool = webringMembers.filter((m) => m.url !== excludeUrl)
  const list = pool.length ? pool : webringMembers
  return list[Math.floor(Math.random() * list.length)]
}
