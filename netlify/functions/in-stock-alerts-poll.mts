import { deliverAlert } from './_lib/instock/dispatch'
import { checkWatch } from './_lib/instock/runner'
import {
  alertsStore,
  listConfigKeys,
  readConfigByKey,
  writeConfigByKey,
} from './_lib/instock/store'
import { isDue } from './_lib/instock/watches'
import type { AlertConfig } from './_lib/instock/types'

/**
 * Scheduled poller for /in-stock-alerts.
 *
 * It runs every minute, but each watch carries its own `nextCheckAt` picked at
 * random inside a 2–5 minute window, so this pass only touches the handful of
 * watches that have actually come due. That gives every page a jittered 2–5
 * minute cadence without needing a timer per watch.
 */

/** Ceiling per invocation so one busy account cannot run the function to timeout. */
const MAX_CHECKS_PER_RUN = 24

export default async (): Promise<Response> => {
  const store = alertsStore()
  const now = Date.now()

  let keys: string[]
  try {
    keys = await listConfigKeys(store)
  } catch (err) {
    console.error('in-stock-alerts poll: cannot list configs', err)
    return new Response('list failed', { status: 500 })
  }

  let checked = 0
  let alerted = 0

  for (const key of keys) {
    if (checked >= MAX_CHECKS_PER_RUN) break

    const stored = await readConfigByKey(store, key)
    if (!stored) continue

    let account: AlertConfig = stored
    let dirty = false

    for (const watch of stored.watches) {
      if (checked >= MAX_CHECKS_PER_RUN) break
      if (!isDue(watch, now)) continue

      checked += 1
      const outcome = await checkWatch(watch, { now: Date.now() })
      let updated = outcome.watch

      if (outcome.shouldAlert && outcome.detection) {
        const delivery = await deliverAlert(account, updated, outcome.detection)
        account = delivery.config
        if (delivery.channels.length > 0) {
          alerted += 1
          updated = { ...updated, lastAlertAt: new Date().toISOString() }
        }
        if (delivery.errors.length > 0) {
          console.error(`in-stock-alerts: delivery problems for ${updated.url}: ${delivery.errors.join('; ')}`)
        }
      }

      account = { ...account, watches: account.watches.map((w) => (w.id === updated.id ? updated : w)) }
      dirty = true
    }

    if (dirty) {
      try {
        await writeConfigByKey(store, key, account)
      } catch (err) {
        console.error('in-stock-alerts poll: cannot save config', err)
      }
    }
  }

  console.log(`in-stock-alerts poll: ${checked} checked, ${alerted} alerted, ${keys.length} accounts`)
  return new Response(JSON.stringify({ checked, alerted, accounts: keys.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config = { schedule: '* * * * *' }
