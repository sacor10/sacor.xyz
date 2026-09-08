/**
 * Alert delivery. Email goes through Resend (already used for Travel Plan
 * invites). Text goes through Twilio when it is configured; otherwise it falls
 * back to the carrier email-to-SMS gateways, which cost nothing and only need
 * the Resend key that is already set up.
 */

export const CARRIER_GATEWAYS: Record<string, string> = {
  att: 'txt.att.net',
  verizon: 'vtext.com',
  tmobile: 'tmomail.net',
  sprint: 'messaging.sprintpcs.com',
  uscellular: 'email.uscc.net',
  cricket: 'sms.cricketwireless.net',
  boost: 'sms.myboostmobile.com',
  metropcs: 'mymetropcs.com',
  googlefi: 'msg.fi.google.com',
  mint: 'tmomail.net',
  visible: 'vtext.com',
  xfinity: 'vtext.com',
  ting: 'message.ting.com',
  consumercellular: 'mailmymobile.net',
}

export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const emailConfigured = (): boolean =>
  !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)

export const twilioConfigured = (): boolean =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER)

export const smsConfigured = (carrier: string): boolean =>
  twilioConfigured() || (emailConfigured() && !!CARRIER_GATEWAYS[carrier])

export const siteUrl = (req?: Request): string => {
  const configured = String(process.env.SITE_URL || '').trim().replace(/\/+$/, '')
  if (configured) return configured
  if (req) {
    const url = new URL(req.url)
    return `${url.protocol}//${url.host}`
  }
  return 'https://sacor.xyz'
}

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendEmail({ to, subject, html, text }: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) throw new Error('Email sending is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL)')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(data?.message || `Resend failed (${res.status})`)
  }
}

async function sendViaTwilio(phone: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID as string
  const token = process.env.TWILIO_AUTH_TOKEN as string
  const from = process.env.TWILIO_FROM_NUMBER as string

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: phone, From: from, Body: body }).toString(),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    throw new Error(data?.message || `Twilio failed (${res.status})`)
  }
}

/**
 * Texts are capped near one SMS segment: gateway messages get split (and
 * sometimes reordered) past ~160 characters, which turns an urgent alert into
 * three confusing ones.
 */
export const smsBody = (label: string, url: string): string => {
  const prefix = `IN STOCK: ${label}`.slice(0, 60)
  return `${prefix}\n${url}`.slice(0, 300)
}

export async function sendSms(phone: string, carrier: string, body: string): Promise<string> {
  if (!phone) throw new Error('No phone number saved')

  if (twilioConfigured()) {
    await sendViaTwilio(phone, body)
    return 'twilio'
  }

  const gateway = CARRIER_GATEWAYS[carrier]
  if (!gateway) {
    throw new Error('Pick your carrier (or configure Twilio) to receive texts')
  }
  // Gateways key off the plain national number, not the E.164 form.
  const digits = phone.replace(/[^\d]/g, '').replace(/^1(?=\d{10}$)/, '')
  await sendEmail({ to: `${digits}@${gateway}`, subject: '', html: escapeHtml(body), text: body })
  return `sms-gateway:${carrier}`
}
