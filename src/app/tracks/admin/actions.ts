'use server'

import { findByGithubId } from '@/lib/contributors'
import { sendTrackDecisionEmail } from '@/lib/email'
import { isAdmin, isTrackAdmin } from '@/lib/roles'
import { getSession } from '@/lib/session'
import { decideJoinRequest, NotPendingError } from '@/lib/track-members'
import { findTrackBySlug } from '@/lib/tracks'

export interface DecideJoinRequestResult {
  ok: boolean
  message?: string
}

/**
 * IDEA-014's Accept/Reject. Re-checks authorization server-side — a global
 * Admin can decide on any track, a Track Admin only on a track they
 * actually administer (isTrackAdmin, IDEA-011) — the same defense-in-depth
 * as admin/actions.ts's setContributorStatusAction; the page's own gate
 * keeps an unauthorized contributor from ever seeing these buttons, but a
 * server action is reachable directly.
 *
 * Sends IDEA-019's decision email best-effort, after the decision is
 * already persisted — never lets an email failure surface as if the
 * decision itself failed.
 */
export async function decideJoinRequestAction(
  trackSlug: string,
  requesterGithubId: string,
  decision: 'approved' | 'rejected',
): Promise<DecideJoinRequestResult> {
  const session = await getSession()
  if (!session.github) return { ok: false, message: 'Please sign in with GitHub first.' }

  const caller = await findByGithubId(session.github.id)
  if (!caller) return { ok: false, message: 'Please sign in with GitHub first.' }

  const track = await findTrackBySlug(trackSlug)
  if (!track) return { ok: false, message: 'This track no longer exists.' }

  if (!isAdmin(caller) && !(await isTrackAdmin(caller.githubId, track.id))) {
    return { ok: false, message: 'Not authorized.' }
  }

  try {
    await decideJoinRequest(track.id, requesterGithubId, decision, caller.githubId)
  } catch (error) {
    if (error instanceof NotPendingError) {
      return { ok: false, message: 'This request was already decided.' }
    }
    console.error(`decideJoinRequestAction(${trackSlug}, ${requesterGithubId}, ${decision}) failed:`, error)
    return { ok: false, message: 'Could not record this decision right now. Please try again in a moment.' }
  }

  const requester = await findByGithubId(requesterGithubId)
  if (requester?.email) await sendTrackDecisionEmail(requester.email, track.name, decision)

  return { ok: true }
}
