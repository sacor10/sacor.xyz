/** Shared shapes for the in-stock alerts feature (/in-stock-alerts). */

export type Availability = 'in_stock' | 'out_of_stock' | 'unknown'

/** Watch status is availability plus the "the fetch blew up" case. */
export type WatchStatus = Availability | 'error'

/**
 * How a page is judged.
 *  - auto:     structured commerce data first, then stock phrases.
 *  - contains: in stock while `text` appears on the page.
 *  - absent:   in stock while `text` does NOT appear on the page.
 */
export type MatchMode = 'auto' | 'contains' | 'absent'

export interface MatchRule {
  mode: MatchMode
  text: string
}

export interface DetectionResult {
  status: Availability
  /** Human-readable one-liner shown in the UI and in the alert body. */
  reason: string
  /** Every signal that fired, so a surprising verdict can be debugged. */
  signals: string[]
}

export interface Watch {
  id: string
  label: string
  url: string
  enabled: boolean
  match: MatchRule
  notifyEmail: boolean
  notifySms: boolean
  status: WatchStatus
  statusReason: string
  lastCheckedAt: string | null
  lastInStockAt: string | null
  lastAlertAt: string | null
  nextCheckAt: string | null
  consecutiveErrors: number
  createdAt: string
}

export interface AlertEvent {
  id: string
  watchId: string
  label: string
  url: string
  at: string
  channels: string[]
  detail: string
}

export interface AlertConfig {
  schema: number
  /** Where email alerts go. Defaults to the signed-in Google address. */
  email: string
  /** E.164 destination for text alerts; blank disables SMS. */
  phone: string
  /** Carrier key for the email-to-SMS gateway when Twilio is not configured. */
  carrier: string
  watches: Watch[]
  events: AlertEvent[]
  updatedAt: string | null
}
