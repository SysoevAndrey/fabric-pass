'use server'

import { findByGithubId, setContributorStatus } from '@/lib/contributors'
import { isAdmin } from '@/lib/roles'
import { getSession } from '@/lib/session'

export interface SetStatusResult {
  ok: boolean
  message?: string
}

/**
 * IDEA-012's Confirm/Block. Re-checks the caller is actually an Admin
 * server-side, the same defense-in-depth this app already applies
 * elsewhere (e.g. actions.ts's searchContributorsAction re-checking
 * session.github even though the UI never calls it signed out) — the
 * page's own gate keeps a non-admin from ever seeing this button, but a
 * server action is reachable directly, and must not trust that alone.
 */
export async function setContributorStatusAction(githubId: string, status: 'confirmed' | 'blocked'): Promise<SetStatusResult> {
  const session = await getSession()
  if (!session.github) return { ok: false, message: 'Please sign in with GitHub first.' }

  const caller = await findByGithubId(session.github.id)
  if (!caller || !isAdmin(caller)) return { ok: false, message: 'Not authorized.' }

  try {
    await setContributorStatus(githubId, status)
    return { ok: true }
  } catch (error) {
    console.error(`setContributorStatusAction(${githubId}, ${status}) failed:`, error)
    return { ok: false, message: 'Could not update this contributor right now. Please try again in a moment.' }
  }
}
