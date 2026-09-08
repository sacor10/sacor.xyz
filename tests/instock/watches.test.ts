import { describe, expect, it } from 'vitest'
import {
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
  SEED_WATCH,
  defaultConfig,
  isDue,
  mergeSubmittedConfig,
  nextCheckDelayMs,
  normalizePhone,
  normalizeWatchUrl,
  scheduleNextCheck,
} from '../../netlify/functions/_lib/instock/watches'

describe('normalizeWatchUrl', () => {
  it('accepts a normal product URL and drops the fragment', () => {
    expect(normalizeWatchUrl('https://www.nintendo.com/us/store/products/thing-1/#buy')).toBe(
      'https://www.nintendo.com/us/store/products/thing-1/',
    )
  })

  it('rejects non-http schemes', () => {
    expect(() => normalizeWatchUrl('file:///etc/passwd')).toThrow(/http/)
    expect(() => normalizeWatchUrl('javascript:alert(1)')).toThrow(/http/)
  })

  it('rejects private and internal hosts', () => {
    for (const url of [
      'http://localhost:8888/x',
      'http://127.0.0.1/x',
      'http://10.0.0.5/x',
      'http://192.168.1.1/x',
      'http://172.20.3.4/x',
      'http://169.254.169.254/latest/meta-data/',
      'http://intranet/x',
      'http://printer.local/x',
    ]) {
      expect(() => normalizeWatchUrl(url), url).toThrow(/private|internal/i)
    }
  })

  it('rejects credentials in the URL', () => {
    expect(() => normalizeWatchUrl('https://user:pw@example.com/x')).toThrow(/credentials/)
  })

  it('rejects blank input', () => {
    expect(() => normalizeWatchUrl('   ')).toThrow(/required/)
  })
})

describe('poll scheduling', () => {
  it('always lands inside the 2–5 minute window', () => {
    for (const roll of [0, 0.25, 0.5, 0.999999]) {
      const delay = nextCheckDelayMs(() => roll)
      expect(delay).toBeGreaterThanOrEqual(MIN_INTERVAL_MS)
      expect(delay).toBeLessThanOrEqual(MAX_INTERVAL_MS)
    }
  })

  it('spreads checks out instead of firing them in lockstep', () => {
    const delays = new Set(Array.from({ length: 200 }, () => nextCheckDelayMs()))
    expect(delays.size).toBeGreaterThan(50)
  })

  it('schedules from a given instant', () => {
    const at = Date.parse(scheduleNextCheck(0, () => 0))
    expect(at).toBe(MIN_INTERVAL_MS)
  })

  it('treats a watch as due once its time passes, and never when disabled', () => {
    const base = defaultConfig('me@example.com').watches[0]
    expect(isDue({ ...base, nextCheckAt: null }, 1000)).toBe(true)
    expect(isDue({ ...base, nextCheckAt: new Date(5000).toISOString() }, 1000)).toBe(false)
    expect(isDue({ ...base, nextCheckAt: new Date(500).toISOString() }, 1000)).toBe(true)
    expect(isDue({ ...base, enabled: false, nextCheckAt: null }, 1000)).toBe(false)
  })
})

describe('defaultConfig', () => {
  it('seeds the Zelda 40th anniversary watch with email and text armed', () => {
    const config = defaultConfig('me@example.com')
    expect(config.email).toBe('me@example.com')
    expect(config.watches).toHaveLength(1)
    expect(config.watches[0].url).toBe(SEED_WATCH.url)
    expect(config.watches[0].notifyEmail).toBe(true)
    expect(config.watches[0].notifySms).toBe(true)
    expect(config.watches[0].enabled).toBe(true)
  })
})

describe('normalizePhone', () => {
  it('canonicalizes US numbers to E.164', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('+15551234567')
    expect(normalizePhone('1-555-123-4567')).toBe('+15551234567')
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123')
  })

  it('treats blank as "no texts"', () => {
    expect(normalizePhone('')).toBe('')
  })

  it('rejects nonsense', () => {
    expect(() => normalizePhone('12345')).toThrow()
  })
})

describe('mergeSubmittedConfig', () => {
  const current = defaultConfig('me@example.com')
  const existing = current.watches[0]

  it('keeps server-owned poll state for an unchanged watch', () => {
    const checked = {
      ...current,
      watches: [
        {
          ...existing,
          status: 'out_of_stock' as const,
          lastCheckedAt: '2026-01-01T00:00:00.000Z',
          nextCheckAt: '2026-01-01T00:03:00.000Z',
        },
      ],
    }
    const next = mergeSubmittedConfig(
      checked,
      { email: 'me@example.com', phone: '', carrier: '', watches: [{ id: existing.id, label: 'Renamed', url: existing.url }] },
      'me@example.com',
    )
    expect(next.watches[0].label).toBe('Renamed')
    expect(next.watches[0].status).toBe('out_of_stock')
    expect(next.watches[0].lastCheckedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('resets poll state when a watch is pointed at a different page', () => {
    const checked = {
      ...current,
      watches: [{ ...existing, status: 'out_of_stock' as const, lastCheckedAt: '2026-01-01T00:00:00.000Z' }],
    }
    const next = mergeSubmittedConfig(
      checked,
      { watches: [{ id: existing.id, url: 'https://example.com/other', label: 'Other' }] },
      'me@example.com',
    )
    expect(next.watches[0].status).toBe('unknown')
    expect(next.watches[0].lastCheckedAt).toBeNull()
  })

  it('rejects duplicate pages', () => {
    expect(() =>
      mergeSubmittedConfig(current, { watches: [{ url: existing.url }, { url: existing.url }] }, 'me@example.com'),
    ).toThrow(/already on the list/)
  })

  it('rejects a custom rule with no text', () => {
    expect(() =>
      mergeSubmittedConfig(
        current,
        { watches: [{ url: existing.url, match: { mode: 'contains', text: '' } }] },
        'me@example.com',
      ),
    ).toThrow(/text/)
  })

  it('falls back to the session email when none is supplied', () => {
    const next = mergeSubmittedConfig(current, { watches: [] }, 'me@example.com')
    expect(next.email).toBe('me@example.com')
    expect(next.watches).toHaveLength(0)
  })
})
