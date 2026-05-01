import { getStore } from '@netlify/blobs'
import {
  canCreateTravelPlans,
  normalizeEmail,
  requireTravelAccess,
  userHash,
  userKeyPrefix,
} from './_lib/session.mjs'

const planKey = (prefix, id) => `${prefix}/plans/${id}`
const sharedIndexKey = (recipientHash) => `shared/${recipientHash}/index`
const contactsKey = (prefix) => `${prefix}/contacts`

const json = (data, init = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  })

const loadJsonArray = async (store, key) => {
  const raw = await store.get(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveJsonArray = (store, key, list) => store.set(key, JSON.stringify(list))

const uniqueEmails = (emails) => {
  const seen = new Set()
  const out = []
  for (const email of Array.isArray(emails) ? emails : []) {
    const normalized = normalizeEmail(email)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

const normalizePlan = (plan, ownerEmail, ownerHash) => {
  const owner = normalizeEmail(plan?.ownerEmail) || ownerEmail
  return {
    ...plan,
    ownerEmail: owner,
    ownerHash: plan?.ownerHash || ownerHash,
    collaborators: uniqueEmails(plan?.collaborators).filter((email) => email !== owner),
    version: Number.isInteger(plan?.version) && plan.version > 0 ? plan.version : 1,
    updatedBy: normalizeEmail(plan?.updatedBy) || owner,
  }
}

const summaryForPlan = (plan) => ({
  id: plan.id,
  title: plan.title,
  destination: plan.destination || '',
  updatedAt: plan.updatedAt,
  updatedBy: plan.updatedBy || plan.ownerEmail,
  ownerEmail: plan.ownerEmail,
  ownerHash: plan.ownerHash,
  version: plan.version || 1,
  access: 'shared',
})

const loadOwnerPlan = async (store, sessionEmail, id) => {
  if (!id) return { error: json({ error: 'Missing id' }, { status: 400 }) }
  if (!canCreateTravelPlans(sessionEmail)) return { error: json({ error: 'Forbidden' }, { status: 403 }) }
  const ownerHash = userHash(sessionEmail)
  const prefix = userKeyPrefix(sessionEmail)
  const raw = await store.get(planKey(prefix, id))
  if (!raw) return { error: json({ error: 'Not found' }, { status: 404 }) }
  try {
    return { plan: normalizePlan(JSON.parse(raw), sessionEmail, ownerHash), prefix }
  } catch {
    return { error: json({ error: 'Plan data is corrupt' }, { status: 500 }) }
  }
}

const loadContacts = async (store, prefix) => uniqueEmails(await loadJsonArray(store, contactsKey(prefix)))
const saveContacts = (store, prefix, contacts) =>
  saveJsonArray(store, contactsKey(prefix), uniqueEmails(contacts).sort())

const savePlan = async (store, prefix, plan) => {
  await store.set(planKey(prefix, plan.id), JSON.stringify(plan))
}

const updateSharedIndexForEmail = async (store, email, plan) => {
  const recipientHash = userHash(email)
  const list = await loadJsonArray(store, sharedIndexKey(recipientHash))
  const summary = summaryForPlan(plan)
  const idx = list.findIndex((p) => p.id === plan.id && p.ownerHash === plan.ownerHash)
  if (idx >= 0) list[idx] = summary
  else list.unshift(summary)
  await saveJsonArray(store, sharedIndexKey(recipientHash), list)
}

const removeSharedIndexForEmail = async (store, email, plan) => {
  const recipientHash = userHash(email)
  const list = await loadJsonArray(store, sharedIndexKey(recipientHash))
  const next = list.filter((p) => !(p.id === plan.id && p.ownerHash === plan.ownerHash))
  if (next.length !== list.length) await saveJsonArray(store, sharedIndexKey(recipientHash), next)
}

const parseEmails = (value) => {
  const raw = Array.isArray(value) ? value.join('\n') : String(value || '')
  return uniqueEmails(raw.split(/[\s,;]+/))
}

const isEmailish = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const siteUrlForRequest = (req) => {
  const configured = String(process.env.SITE_URL || '').trim().replace(/\/+$/, '')
  if (configured) return configured
  const url = new URL(req.url)
  return `${url.protocol}//${url.host}`
}

const sendInviteEmail = async ({ req, plan, recipient }) => {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) throw new Error('Email sender is not configured')

  const href = `${siteUrlForRequest(req)}/travel-plans/${encodeURIComponent(plan.id)}?owner=${encodeURIComponent(plan.ownerHash)}`
  const subject = `${plan.ownerEmail} shared a travel plan with you`
  const title = escapeHtml(plan.title || 'Travel plan')
  const owner = escapeHtml(plan.ownerEmail)
  const safeHref = escapeHtml(href)
  const html = `
    <p>${owner} shared <strong>${title}</strong> with you on sacor.xyz.</p>
    <p><a href="${safeHref}">Open the travel plan</a></p>
    <p>Sign in with this Google account (${escapeHtml(recipient)}) to view and edit it.</p>
  `
  const text = [
    `${plan.ownerEmail} shared "${plan.title || 'Travel plan'}" with you on sacor.xyz.`,
    '',
    `Open it here: ${href}`,
    '',
    `Sign in with this Google account (${recipient}) to view and edit it.`,
  ].join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject,
      html,
      text,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.message || `Resend failed (${res.status})`)
  }
}

const sharingPayload = async (store, prefix, plan) => ({
  collaborators: plan.collaborators,
  contacts: await loadContacts(store, prefix),
})

export default async (req) => {
  const auth = requireTravelAccess(req)
  if (auth.error) return auth.error

  const sessionEmail = normalizeEmail(auth.session.email)
  const store = getStore('travel-plans')
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const contactToDelete = normalizeEmail(url.searchParams.get('contact'))

  if (req.method === 'DELETE' && contactToDelete) {
    if (!canCreateTravelPlans(sessionEmail)) return json({ error: 'Forbidden' }, { status: 403 })
    const prefix = userKeyPrefix(sessionEmail)
    const contacts = await loadContacts(store, prefix)
    const next = contacts.filter((email) => email !== contactToDelete)
    await saveContacts(store, prefix, next)
    return json({ contacts: next })
  }

  const loaded = await loadOwnerPlan(store, sessionEmail, id)
  if (loaded.error) return loaded.error
  const { plan, prefix } = loaded

  if (req.method === 'GET') {
    return json(await sharingPayload(store, prefix, plan))
  }

  if (req.method === 'POST') {
    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const emails = parseEmails(body?.emails ?? body?.email)
    if (emails.length === 0) return json({ error: 'Add at least one email address' }, { status: 400 })
    if (emails.length > 50) return json({ error: 'Too many recipients (max 50)' }, { status: 400 })

    const existing = new Set(plan.collaborators)
    const contacts = new Set(await loadContacts(store, prefix))
    const newlyShared = []
    const results = []

    for (const email of emails) {
      if (!isEmailish(email)) {
        results.push({ email, status: 'invalid', emailStatus: 'skipped', error: 'Invalid email address' })
      } else if (email === sessionEmail) {
        results.push({ email, status: 'self', emailStatus: 'skipped', error: 'You already own this plan' })
      } else if (existing.has(email)) {
        results.push({ email, status: 'already_shared', emailStatus: 'skipped' })
      } else {
        existing.add(email)
        contacts.add(email)
        newlyShared.push(email)
        results.push({ email, status: 'shared', emailStatus: 'pending' })
      }
    }

    if (newlyShared.length > 0) {
      plan.collaborators = [...existing].sort()
      await savePlan(store, prefix, plan)
      await saveContacts(store, prefix, [...contacts])
      await Promise.all(newlyShared.map((email) => updateSharedIndexForEmail(store, email, plan)))

      await Promise.all(
        results
          .filter((result) => result.status === 'shared')
          .map(async (result) => {
            try {
              await sendInviteEmail({ req, plan, recipient: result.email })
              result.emailStatus = 'sent'
            } catch (err) {
              result.emailStatus = 'failed'
              result.error = err.message
            }
          }),
      )
    }

    return json({
      results,
      ...(await sharingPayload(store, prefix, plan)),
    })
  }

  if (req.method === 'DELETE') {
    const email = normalizeEmail(url.searchParams.get('email'))
    if (!email) return json({ error: 'Missing email' }, { status: 400 })
    if (email === sessionEmail) return json({ error: 'The owner cannot be removed' }, { status: 400 })
    const before = plan.collaborators.length
    plan.collaborators = plan.collaborators.filter((collaborator) => collaborator !== email)
    if (plan.collaborators.length !== before) {
      await savePlan(store, prefix, plan)
      await removeSharedIndexForEmail(store, email, plan)
    }
    return json(await sharingPayload(store, prefix, plan))
  }

  return new Response('Method Not Allowed', { status: 405 })
}
