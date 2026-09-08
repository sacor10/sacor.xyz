import { describe, expect, it } from 'vitest'
import { detectAvailability } from '../../netlify/functions/_lib/instock/detect'

const auto = { mode: 'auto' as const, text: '' }

describe('detectAvailability — structured data', () => {
  it('reads schema.org InStock', () => {
    const html = '<script type="application/ld+json">{"@type":"Offer","availability":"https://schema.org/InStock"}</script>'
    expect(detectAvailability(html, auto).status).toBe('in_stock')
  })

  it('reads schema.org OutOfStock', () => {
    const html = '<script>{"availability":"https://schema.org/OutOfStock"}</script>'
    expect(detectAvailability(html, auto).status).toBe('out_of_stock')
  })

  it('treats pre-order as buyable', () => {
    const html = '{"availability":"PreOrder"}'
    expect(detectAvailability(html, auto).status).toBe('in_stock')
  })

  it('reads boolean commerce flags out of hydration JSON', () => {
    expect(detectAvailability('{"inStock":true}', auto).status).toBe('in_stock')
    expect(detectAvailability('{"inStock":false}', auto).status).toBe('out_of_stock')
    expect(detectAvailability('{"soldOut":true}', auto).status).toBe('out_of_stock')
    expect(detectAvailability('{"soldOut":false}', auto).status).toBe('in_stock')
  })

  it('sees through the escaping used inside <script> payloads', () => {
    const html = '<script>window.__DATA__ = "{\\"availability\\":\\"InStock\\"}"</script>'
    expect(detectAvailability(html, auto).status).toBe('in_stock')
  })

  it('lets structured data beat the visible copy', () => {
    const html = '<button>Add to Cart</button>{"availability":"SoldOut"}'
    expect(detectAvailability(html, auto).status).toBe('out_of_stock')
  })
})

describe('detectAvailability — phrase fallback', () => {
  it('falls back to buy phrases when there is no commerce JSON', () => {
    expect(detectAvailability('<button>Add to Cart</button>', auto).status).toBe('in_stock')
  })

  it('prefers the sold-out phrase when a page carries both', () => {
    const html = '<button hidden>Add to cart</button><p>Sold out</p>'
    const result = detectAvailability(html, auto)
    expect(result.status).toBe('out_of_stock')
    expect(result.signals).toContain('"sold out"')
  })

  it('reports unknown rather than guessing on a page with no signal', () => {
    expect(detectAvailability('<h1>hello</h1>', auto).status).toBe('unknown')
  })

  it('is case-insensitive', () => {
    expect(detectAvailability('<P>OUT OF STOCK</P>', auto).status).toBe('out_of_stock')
  })
})

describe('detectAvailability — custom rules', () => {
  it('contains mode treats the needle as the in-stock signal', () => {
    const rule = { mode: 'contains' as const, text: 'Add to Cart' }
    expect(detectAvailability('<button>ADD TO CART</button>', rule).status).toBe('in_stock')
    expect(detectAvailability('<p>Sold out</p>', rule).status).toBe('out_of_stock')
  })

  it('absent mode treats the needle as the sold-out signal', () => {
    const rule = { mode: 'absent' as const, text: 'Sold out' }
    expect(detectAvailability('<p>Sold Out</p>', rule).status).toBe('out_of_stock')
    expect(detectAvailability('<button>Buy</button>', rule).status).toBe('in_stock')
  })

  it('refuses to judge an empty custom rule', () => {
    expect(detectAvailability('<p>Sold out</p>', { mode: 'contains', text: '  ' }).status).toBe('unknown')
  })
})
