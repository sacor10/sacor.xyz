const FEEDS = [
  { url: 'https://cremieux.substack.com/feed',     name: 'Cremieux Recueil' },
  { url: 'https://trcenter.substack.com/feed',      name: 'TR Center'        },
  { url: 'https://thenewoutlook.substack.com/feed', name: 'The New Outlook'  },
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

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
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
      title:       extractTag(block, 'title') || '(Untitled)',
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
