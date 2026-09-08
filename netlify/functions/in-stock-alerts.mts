import { readSessionCookie } from './_lib/session.mjs'
import { deliverAlert } from './_lib/instock/dispatch'
import { CARRIER_GATEWAYS, emailConfigured, twilioConfigured } from './_lib/instock/notify'
import { alertsStore, readConfig, writeConfig } from './_lib/instock/store'
import { checkWatch } from './_lib/instock/runner'
import {
  MAX_WATCHES,
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
  mergeSubmittedConfig,
} from './_lib/instock/watches'
import type { AlertConfig } from './_lib/instock/types'

/**
 * Config API for /in-stock-alerts. Everything here is per signed-in account:
 *   GET               read the saved watch list (seeded on first visit)
 *   PUT               replace the editable half of the config
 *   POST ?check=<id>  check one page right now instead of waiting for the poller
 *
 * The recurring 2–5 minute polling lives in in-stock-alerts-poll.mts.
 */

const MANUAL_CHECK_COOLDOWN_MS = 15_000

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

const payload = (config: AlertConfig) => ({
  ...config,
  capabilities: {
    email: emailConfigured(),
    twilio: twilioConfigured(),
    sms: twilioConfigured() || emailConfigured(),
    carriers: Object.keys(CARRIER_GATEWAYS).sort(),
    minIntervalMs: MIN_INTERVAL_MS,
    maxIntervalMs: MAX_INTERVAL_MS,
    maxWatches: MAX_WATCHES,
  },
})

export default async (req: Request): Promise<Response> => {
  const session = readSessionCookie(req)
  if (!session) return json({ error: 'Unauthorized' }, 401)

  const store = alertsStore()
  const email = session.email

  if (req.method === 'GET') {
    const config = await readConfig(store, email)
    // Seed the default watch list on first read so the page is never empty.
    if (!config.updatedAt) await writeConfig(store, email, config)
    return json(payload(config))
  }

  if (req.method === 'PUT') {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    const current = await readConfig(store, email)
    let next: AlertConfig
    try {
      next = mergeSubmittedConfig(current, body, email)
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Invalid config' }, 400)
    }

    await writeConfig(store, email, next)
    return json(payload(next))
  }

  if (req.method === 'POST') {
    const watchId = new URL(req.url).searchParams.get('check')
    if (!watchId) return json({ error: 'Nothing to do — pass ?check=<watch id>' }, 400)

    const config = await readConfig(store, email)
    const index = config.watches.findIndex((watch) => watch.id === watchId)
    if (index === -1) return json({ error: 'No such watch' }, 404)

    const watch = config.watches[index]
    const lastCheckedMs = watch.lastCheckedAt ? Date.parse(watch.lastCheckedAt) : NaN
    if (Number.isFinite(lastCheckedMs) && Date.now() - lastCheckedMs < MANUAL_CHECK_COOLDOWN_MS) {
      return json({ error: 'Just checked that one — give it a few seconds' }, 429)
    }

    const outcome = await checkWatch(watch)
    let next: AlertConfig = { ...config, watches: config.watches.map((w, i) => (i === index ? outcome.watch : w)) }

    if (outcome.shouldAlert && outcome.detection) {
      const delivery = await deliverAlert(next, outcome.watch, outcome.detection, req)
      next = delivery.config
      if (delivery.channels.length > 0) {
        const alerted = { ...outcome.watch, lastAlertAt: new Date().toISOString() }
        next = { ...next, watches: next.watches.map((w) => (w.id === alerted.id ? alerted : w)) }
      }
    }

    await writeConfig(store, email, next)
    return json(payload(next))
  }

  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, PUT, POST' } })
}
