'use server'

import { ContributorNotFoundError, isDetailField, saveField as persistField } from '@/lib/contributors'
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
 *
 * `field` is a plain string, not `DetailField`: a `'use server'` action is an
 * HTTP endpoint, so whatever the client's build-time type says, an arbitrary
 * value can arrive here at runtime. `validateField` is what actually checks
 * it against the closed set of real fields.
 */
export async function saveField(field: string, raw: string): Promise<FieldSaveResult> {
  const session = await getSession()
  if (!session.github) return { ok: false, message: 'Please sign in with GitHub first.' }

  // Narrows `field` for the persistField call below. validateField re-checks
  // this same closed set on its own (it's called elsewhere with a plain
  // string too), so this isn't the only guard — but it's what lets the
  // compiler prove the value handed to persistField is a real DetailField
  // rather than whatever a caller of this action sent.
  if (!isDetailField(field)) return { ok: false, message: 'Unknown field' }

  const validated = validateField(field, raw)
  if (!validated.ok) return { ok: false, message: validated.message }

  try {
    await persistField(session.github.id, field, validated.value)
    return { ok: true }
  } catch (error) {
    if (error instanceof ContributorNotFoundError) {
      // Retrying can never help here — the row this session's cookie names
      // is simply gone — so the person needs to sign in again, not wait a
      // moment and try the same save.
      console.error(`saveField(${field}) failed: contributor row is gone for this session`, error)
      return { ok: false, message: 'Your session no longer matches a saved contributor. Please sign in with GitHub again.' }
    }
    console.error(`saveField(${field}) failed:`, error)
    return { ok: false, message: 'Could not save right now. Please try again in a moment.' }
  }
}
