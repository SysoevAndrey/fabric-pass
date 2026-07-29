'use server'

import { saveField as persistField, type DetailField } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { validateField } from '@/app/form-schema'

export interface FieldSaveResult {
  ok: boolean
  message?: string
}

/**
 * Autosaves one field at a time — called from the client on a debounced
 * change and again on blur, never from a form submit. There is no Save
 * button any more: this is the only path a keystroke has to the database.
 */
export async function saveField(field: DetailField, raw: string): Promise<FieldSaveResult> {
  const session = await getSession()
  if (!session.github) return { ok: false, message: 'Please sign in with GitHub first.' }

  const validated = validateField(field, raw)
  if (!validated.ok) return { ok: false, message: validated.message }

  try {
    await persistField(session.github.id, field, validated.value)
    return { ok: true }
  } catch (error) {
    console.error(`saveField(${field}) failed:`, error)
    return { ok: false, message: 'Could not save right now. Please try again in a moment.' }
  }
}
