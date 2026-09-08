import { getStore, type Store } from '@netlify/blobs'
import { userKeyPrefix } from '../session.mjs'
import { defaultConfig, normalizeConfig } from './watches'
import type { AlertConfig } from './types'

export const STORE_NAME = 'in-stock-alerts'

/**
 * Config keys are hashed by email (same scheme as stock pins and travel
 * plans), so the scheduled poller cannot recover an address from a key. That
 * is why each record also carries the destination email inside it.
 */
export const configKey = (email: string): string => `${userKeyPrefix(email)}/in-stock-alerts/config`

export const alertsStore = (): Store => getStore(STORE_NAME)

export async function readConfig(store: Store, email: string): Promise<AlertConfig> {
  const raw = await store.get(configKey(email))
  if (!raw) return defaultConfig(email)
  try {
    return normalizeConfig(JSON.parse(raw), email)
  } catch {
    return defaultConfig(email)
  }
}

export async function writeConfig(store: Store, email: string, config: AlertConfig): Promise<void> {
  await store.set(configKey(email), JSON.stringify(config))
}

/** Reads a record the poller found by key, where no session email is at hand. */
export async function readConfigByKey(store: Store, key: string): Promise<AlertConfig | null> {
  const raw = await store.get(key)
  if (!raw) return null
  try {
    return normalizeConfig(JSON.parse(raw), '')
  } catch {
    return null
  }
}

export async function writeConfigByKey(store: Store, key: string, config: AlertConfig): Promise<void> {
  await store.set(key, JSON.stringify(config))
}

export async function listConfigKeys(store: Store): Promise<string[]> {
  const { blobs } = await store.list({ prefix: 'users/' })
  return blobs.map((blob) => blob.key).filter((key) => key.endsWith('/in-stock-alerts/config'))
}
