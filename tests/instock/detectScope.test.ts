import { describe, expect, it } from 'vitest'
import { detectAvailability } from '../../netlify/functions/_lib/instock/detect'

const auto = { mode: 'auto' as const, text: '' }

const PRODUCT_URL = 'https://www.nintendo.com/us/store/products/zelda-40th-anniversary-edition-121642/'

/**
 * Shaped like a real storefront page: a breadcrumb block, the product's own
 * JSON-LD, a "you may also like" carousel of other products, and body copy
 * carrying BOTH an add-to-cart button and a sold-out label. Only product
 * scoping can read this correctly.
 */
const storePage = ({
  main,
  related = 'OutOfStock',
  url = PRODUCT_URL,
}: {
  main: string
  related?: string
  url?: string
}) => `<!doctype html><html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
  {"@type":"ListItem","position":1,"item":{"@type":"Thing","name":"Store"}}]}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product",
 "name":"The Legend of Zelda 40th Anniversary Edition",
 "url":"${url}",
 "offers":{"@type":"Offer","price":"499.99","priceCurrency":"USD",
           "availability":"https://schema.org/${main}"}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"ItemList","name":"You may also like",
 "itemListElement":[
   {"@type":"ListItem","position":1,"item":{"@type":"Product","name":"Pro Controller",
    "url":"https://www.nintendo.com/us/store/products/pro-controller/",
    "offers":{"@type":"Offer","availability":"https://schema.org/${related}"}}}]}
</script>
</head><body>
<button class="add-to-cart">Add to Cart</button>
<div class="carousel"><span>Sold out</span></div>
</body></html>`

describe('product-scoped detection', () => {
  it('ignores a sold-out recommendation carousel when the product is buyable', () => {
    // The whole-page sweep would call this SOLD OUT: the carousel contributes an
    // OutOfStock offer and the body says "Sold out". Scoping is what saves it.
    const result = detectAvailability(storePage({ main: 'InStock' }), auto, PRODUCT_URL)
    expect(result.status).toBe('in_stock')
    expect(result.source).toBe('product')
  })

  it('ignores an in-stock recommendation carousel when the product is sold out', () => {
    const result = detectAvailability(
      storePage({ main: 'OutOfStock', related: 'InStock' }),
      auto,
      PRODUCT_URL,
    )
    expect(result.status).toBe('out_of_stock')
    expect(result.source).toBe('product')
  })

  it('picks the watched product when the page describes several', () => {
    const html = `
      <script type="application/ld+json">
      [{"@type":"Product","url":"https://shop.test/other","offers":{"availability":"https://schema.org/InStock"}},
       {"@type":"Product","url":"https://shop.test/watched","offers":{"availability":"https://schema.org/OutOfStock"}}]
      </script>`
    expect(detectAvailability(html, auto, 'https://shop.test/watched').status).toBe('out_of_stock')
    expect(detectAvailability(html, auto, 'https://shop.test/other').status).toBe('in_stock')
  })

  it('matches the product url loosely (scheme, www., trailing slash, query)', () => {
    const html = storePage({ main: 'InStock', url: 'https://www.nintendo.com/us/store/products/zelda-40th-anniversary-edition-121642' })
    const result = detectAvailability(html, auto, 'http://nintendo.com/us/store/products/zelda-40th-anniversary-edition-121642/?utm_source=x')
    expect(result.status).toBe('in_stock')
    expect(result.reason).toContain('this product')
  })

  it('counts any buyable variant of a ProductGroup as in stock', () => {
    const html = `
      <script type="application/ld+json">
      {"@type":"ProductGroup","url":"https://shop.test/thing","hasVariant":[
        {"@type":"Product","name":"Blue","offers":{"availability":"https://schema.org/OutOfStock"}},
        {"@type":"Product","name":"Red","offers":{"availability":"https://schema.org/InStock"}}]}
      </script>`
    expect(detectAvailability(html, auto, 'https://shop.test/thing').status).toBe('in_stock')
  })

  it('reads offers nested inside an AggregateOffer', () => {
    const html = `
      <script type="application/ld+json">
      {"@type":"Product","url":"https://shop.test/x","offers":{"@type":"AggregateOffer","offerCount":2,
        "offers":[{"@type":"Offer","availability":"https://schema.org/OutOfStock"},
                  {"@type":"Offer","availability":"https://schema.org/InStock"}]}}
      </script>`
    expect(detectAvailability(html, auto, 'https://shop.test/x').status).toBe('in_stock')
  })

  it('reads an availability given as an object', () => {
    const html = `
      <script type="application/ld+json">
      {"@type":"Product","url":"https://shop.test/x",
       "offers":{"availability":{"@id":"https://schema.org/OutOfStock"}}}
      </script>`
    expect(detectAvailability(html, auto, 'https://shop.test/x').status).toBe('out_of_stock')
  })

  it('finds a product nested in an @graph', () => {
    const html = `
      <script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"WebPage","name":"page"},
        {"@type":"Product","url":"https://shop.test/x","offers":{"availability":"InStock"}}]}
      </script>`
    expect(detectAvailability(html, auto, 'https://shop.test/x').source).toBe('product')
  })
})

describe('falling back off the scoped tier', () => {
  it('drops to the page sweep when JSON-LD has no product offers', () => {
    const html = `
      <script type="application/ld+json">{"@type":"WebSite","name":"Shop"}</script>
      <script>window.__DATA__={"availability":"OutOfStock"}</script>`
    const result = detectAvailability(html, auto, 'https://shop.test/x')
    expect(result.status).toBe('out_of_stock')
    expect(result.source).toBe('page')
  })

  it('drops to the page sweep when JSON-LD is malformed', () => {
    const html = `
      <script type="application/ld+json">{ this is not json </script>
      <button>Add to Cart</button>`
    const result = detectAvailability(html, auto, 'https://shop.test/x')
    expect(result.status).toBe('in_stock')
    expect(result.source).toBe('phrases')
  })

  it('recovers HTML-escaped JSON-LD instead of falling through', () => {
    const html = `
      <script type="application/ld+json">
      {&quot;@type&quot;:&quot;Product&quot;,&quot;url&quot;:&quot;https://shop.test/x&quot;,
       &quot;offers&quot;:{&quot;availability&quot;:&quot;https://schema.org/InStock&quot;}}
      </script>`
    const result = detectAvailability(html, auto, 'https://shop.test/x')
    expect(result.source).toBe('product')
    expect(result.status).toBe('in_stock')
  })

  it('still reports unknown when nothing anywhere says anything', () => {
    const result = detectAvailability('<h1>hello</h1>', auto, 'https://shop.test/x')
    expect(result.status).toBe('unknown')
    expect(result.source).toBe('none')
  })
})

describe('back-order handling', () => {
  it('treats BackOrder as not buyable in scoped product data', () => {
    const html = `
      <script type="application/ld+json">
      {"@type":"Product","url":"https://shop.test/x","offers":{"availability":"https://schema.org/BackOrder"}}
      </script>`
    const result = detectAvailability(html, auto, 'https://shop.test/x')
    expect(result.status).toBe('out_of_stock')
    expect(result.source).toBe('product')
  })

  it('treats BackOrder as not buyable in the page sweep too', () => {
    expect(detectAvailability('{"availability":"BackOrder"}', auto).status).toBe('out_of_stock')
  })

  it('still treats PreOrder as buyable', () => {
    const html = `
      <script type="application/ld+json">
      {"@type":"Product","url":"https://shop.test/x","offers":{"availability":"https://schema.org/PreOrder"}}
      </script>`
    expect(detectAvailability(html, auto, 'https://shop.test/x').status).toBe('in_stock')
  })
})
