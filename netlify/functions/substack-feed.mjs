const FEEDS = [
  { url: 'https://cremieux.substack.com/feed',     name: 'Cremieux Recueil' },
  { url: 'https://trcenter.substack.com/feed',      name: 'TR Center'        },
  { url: 'https://thenewoutlook.substack.com/feed', name: 'The New Outlook'  },
  { url: 'https://mtslive.substack.com/feed',        name: 'MTS Live'         },
  { url: 'https://www.a16z.news/feed',              name: 'a16z News'        },
  { url: 'https://www.macroedge.world/feed',        name: 'MacroEdge'        },
  { url: 'https://moreincommon.substack.com/feed',  name: 'More in Common'   },
  { url: 'https://www.lennysnewsletter.com/feed',   name: "Lenny's Newsletter" },
  { url: 'https://thatskaizen.substack.com/feed',   name: "That's Kaizen"    },
  { url: 'https://blog.exitgroup.us/feed',          name: "EXIT Newsletter"  },
  { url: 'https://samkriss.substack.com/feed',      name: "Numb at the Lodge" },
  { url: 'https://www.bullypulpit.eco/feed',        name: "The Bully Pulpit" },
]

const TTL_MS = 30 * 60 * 1000
const cache = new Map()

function extractTag(xml, tag) {
  const escaped = tag.replace(':', '\\:')
  const re = new RegExp(
    `<${escaped}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${escaped}>`,
    'i'
  )
  const m = xml.match(re)
  return m ? m[1].trim() : ''
}

function extractAttr(xml, tag, attr) {
  const escaped = tag.replace(':', '\\:')
  const re = new RegExp(`<${escaped}[^>]*\\s${attr}="([^"]*)"`, 'i')
  const m = xml.match(re)
  return m ? m[1] : ''
}

function extractFirstImgSrc(html) {
  const m = html.match(/<img[^>]+src="([^"]+)"/i)
  return m ? m[1] : null
}

function decodeHtmlEntities(text) {
  const namedEntities = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  }

  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, value) => {
    if (value[0] === '#') {
      const isHex = value[1]?.toLowerCase() === 'x'
      const codePoint = Number.parseInt(value.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint)
    }

    return namedEntities[value.toLowerCase()] ?? entity
  })
}

function stripHtml(html) {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(text, max = 200) {
  if (text.length <= max) return text
  const cut = text.lastIndexOf(' ', max)
  return text.slice(0, cut > 0 ? cut : max) + '...'
}

async function fetchFeed({ url, name }) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; sacor.xyz RSS reader)',
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
  })
  if (!res.ok) throw new Error(`feed ${name} returned ${res.status}`)
  const xml = await res.text()

  return xml.split('<item>').slice(1).map(block => {
    const rawDesc = extractTag(block, 'description')
    return {
      title:       decodeHtmlEntities(extractTag(block, 'title') || '(Untitled)'),
      link:        extractTag(block, 'link')  || '',
      pubDate:     extractTag(block, 'pubDate'),
      author:      extractTag(block, 'dc:creator') || extractTag(block, 'author') || name,
      description: truncate(stripHtml(rawDesc)),
      image:       extractAttr(block, 'media:content', 'url')
                || extractAttr(block, 'enclosure', 'url')
                || extractFirstImgSrc(rawDesc)
                || null,
      feedName:    name,
    }
  })
}

export default async function handler(req, context) {
  const now = Date.now()
  const cached = cache.get('substack')

  if (cached && now - cached.ts < TTL_MS) {
    return new Response(JSON.stringify(cached.payload), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }

  try {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed))
    const allItems = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    cache.set('substack', { ts: now, payload: allItems })
    return new Response(JSON.stringify(allItems), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch {
    if (cached) {
      return new Response(JSON.stringify(cached.payload), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      })
    }
    return new Response(JSON.stringify({ error: 'feed fetch failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
