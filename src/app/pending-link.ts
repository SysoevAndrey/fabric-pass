import type { Identity } from '@/lib/providers/types'

/**
 * True when a session's pending link for a provider does not match what is
 * already on the contributor's stored row — i.e. it lives only in the
 * session cookie right now, and a Save is what would record it. Saving
 * always clears `session.pending` on success (see `actions.ts`), so a
 * pending link that already equals the stored identity is not "unsaved" —
 * only a mismatch (including "nothing stored yet") is.
 */
export function isUnsaved(pending: Identity | undefined, storedProviderId: string | undefined): boolean {
  return pending !== undefined && pending.providerId !== storedProviderId
}
