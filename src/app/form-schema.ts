import { z } from 'zod'
import { isDetailField } from '@/lib/contributors'

export interface FieldValidation {
  ok: boolean
  /** The value to persist. Absent (rather than an empty string) clears the column. */
  value?: string
  message?: string
}

/**
 * Validates one autosaved field. `field` arrives as a plain string — this is
 * the entry point for the `saveField` server action, which is reachable as
 * an HTTP endpoint where `DetailField` has already been erased to `string` —
 * so the closed set of real fields is checked explicitly before anything
 * else, rather than trusting the caller's compile-time type.
 *
 * Name and company accept anything, trimmed — blank means "not filled in
 * yet" rather than an error, since a half-filled row is an accepted state
 * now that there is no Save button to gate on. Email is the one field
 * checked for shape: saving a string that merely looks like it's mid-typing
 * is fine, but a value the contributor considers finished (on blur, or after
 * they pause) that doesn't look like an email is a typo worth catching
 * rather than silently keeping.
 */
export function validateField(field: string, raw: string): FieldValidation {
  if (!isDetailField(field)) return { ok: false, message: 'Unknown field' }

  const trimmed = raw.trim()
  if (field !== 'email') return { ok: true, value: trimmed || undefined }

  if (trimmed === '') return { ok: true, value: undefined }
  const parsed = z.email().safeParse(trimmed)
  if (!parsed.success) return { ok: false, message: 'That does not look like an email address' }
  return { ok: true, value: parsed.data }
}
