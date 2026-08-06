// Shared error shape for the Pay Index backend — mirrors the `{ code,
// message }` JSON envelope used across netlify/functions (see
// netlify/functions/_lib/songid/errors.ts for the sibling pattern).

export class PayIndexError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status = 500) {
    super(message)
    this.name = 'PayIndexError'
    this.code = code
    this.status = status
  }
}

// Thrown when the live basket (src/data/payIndex) no longer matches what
// was recorded for its version — either in the checked-in fingerprint or in
// the DB's pay_index_basket_versions table. Deliberately fatal: methodology
// rule 1 is "never silently" change the basket, so a mismatch must stop the
// pipeline, not degrade it.
export class BasketIntegrityError extends PayIndexError {
  constructor(message: string) {
    super('basket_integrity_error', message, 500)
    this.name = 'BasketIntegrityError'
  }
}
