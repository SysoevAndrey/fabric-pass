import { z } from 'zod'
import type { DetailField } from '@/lib/contributors'

export interface FieldValidation {
  ok: boolean
  /** The value to persist. Absent (rather than an empty string) clears the column. */
  value?: string
  message?: string
}

/**
 * Validates one autosaved field. Name and company accept anything, trimmed
 * — blank means "not filled in yet" rather than an error, since a
 * half-filled row is an accepted state now that there is no Save button to
 * gate on. Email is the one field checked for shape: saving a string that
 * merely looks like it's mid-typing is fine, but a value the contributor
 * considers finished (on blur, or after they pause) that doesn't look like
 * an email is a typo worth catching rather than silently keeping.
 */
export function validateField(field: DetailField, raw: string): FieldValidation {
  const trimmed = raw.trim()
  if (field !== 'email') return { ok: true, value: trimmed || undefined }

  if (trimmed === '') return { ok: true, value: undefined }
  const parsed = z.email().safeParse(trimmed)
  if (!parsed.success) return { ok: false, message: 'That does not look like an email address' }
  return { ok: true, value: parsed.data }
}
