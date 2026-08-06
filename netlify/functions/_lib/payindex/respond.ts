// Shared JSON response envelope for the Pay Index read functions — mirrors
// the `{ code, message }` error convention used across netlify/functions
// (see quotes.mjs). Every response is public data with no session gate, so
// there's no auth handling here; GET-only, always no-store.

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

export function methodNotAllowed(): Response {
  return json({ code: 'method_not_allowed', message: 'Only GET is supported.' }, 405)
}

export function serverError(err: unknown): Response {
  console.error('pay-index function error', err)
  return json({ code: 'internal_error', message: 'Something went wrong loading Pay Index data.' }, 500)
}
