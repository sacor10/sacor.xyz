import { randomUUID } from 'node:crypto'
import { escapeHtml, sendEmail, sendSms, siteUrl, smsBody } from './notify'
import { recordEvent } from './watches'
import type { AlertConfig, AlertEvent, DetectionResult, Watch } from './types'

/**
 * Turns one "it's in stock" verdict into the actual email/text, then folds the
 * result back into the stored config. A channel that fails is reported rather
 * than thrown: an SMS gateway outage must not swallow the email that worked.
 */

export interface DeliveryResult {
  channels: string[]
  errors: string[]
  config: AlertConfig
}

const alertEmail = (watch: Watch, detection: DetectionResult, home: string) => {
  const label = escapeHtml(watch.label)
  const url = escapeHtml(watch.url)
  const reason = escapeHtml(detection.reason)

  return {
    subject: `IN STOCK: ${watch.label}`,
    html: [
      `<p><strong>${label}</strong> just came back in stock.</p>`,
      `<p><a href="${url}">${url}</a></p>`,
      `<p>Why we think so: ${reason}</p>`,
      `<p style="color:#666">Manage this alert at <a href="${escapeHtml(`${home}/in-stock-alerts`)}">${escapeHtml(home)}/in-stock-alerts</a></p>`,
    ].join('\n'),
    text: [
      `${watch.label} just came back in stock.`,
      '',
      watch.url,
      '',
      `Why we think so: ${detection.reason}`,
      '',
      `Manage this alert: ${home}/in-stock-alerts`,
    ].join('\n'),
  }
}

export async function deliverAlert(
  config: AlertConfig,
  watch: Watch,
  detection: DetectionResult,
  req?: Request,
): Promise<DeliveryResult> {
  const home = siteUrl(req)
  const channels: string[] = []
  const errors: string[] = []

  if (watch.notifyEmail && config.email) {
    try {
      await sendEmail({ to: config.email, ...alertEmail(watch, detection, home) })
      channels.push('email')
    } catch (err) {
      errors.push(`email: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (watch.notifySms && config.phone) {
    try {
      const via = await sendSms(config.phone, config.carrier, smsBody(watch.label, watch.url))
      channels.push(via.startsWith('sms-gateway') ? 'text' : 'text (twilio)')
    } catch (err) {
      errors.push(`text: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const event: AlertEvent = {
    id: randomUUID(),
    watchId: watch.id,
    label: watch.label,
    url: watch.url,
    at: new Date().toISOString(),
    channels,
    detail: errors.length > 0 ? `${detection.reason} — ${errors.join('; ')}` : detection.reason,
  }

  return { channels, errors, config: recordEvent(config, event) }
}
