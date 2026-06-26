import { requireOwner } from './_lib/session.mjs'
import {
  addModerator,
  loadModerators,
  removeModerator,
  requireModerator,
} from './_lib/moderators.mjs'
import { getUsersStore, json } from './_lib/stumble.mjs'

// Manage the moderator roster (Google accounts only — auth is Google-only).
// GET is open to any moderator so the team can see the roster; mutations are
// restricted to env-var owners (super-admins).
export default async (req) => {
  const store = getUsersStore()

  if (req.method === 'GET') {
    const access = await requireModerator(req)
    if (access.error) return access.error
    const moderators = await loadModerators(store)
    return json({ moderators, canManage: access.session.isOwner === true })
  }

  // Mutations: env-var owners only.
  const owner = requireOwner(req)
  if (owner.error) return owner.error

  if (req.method === 'POST') {
    let body
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const email = typeof body?.email === 'string' ? body.email : ''
    if (body?.action === 'remove') {
      const result = await removeModerator(store, email)
      return json({ ok: true, ...result })
    }
    const result = await addModerator(store, email, owner.session.email)
    if (result.error) return json({ error: result.error }, { status: 400 })
    return json({ ok: true, ...result })
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url)
    const email = url.searchParams.get('email') || ''
    const result = await removeModerator(store, email)
    return json({ ok: true, ...result })
  }

  return new Response('Method Not Allowed', { status: 405 })
}
