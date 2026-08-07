import { findByGithubId } from '@/lib/contributors'
import { isAdmin, adminTrackIds } from '@/lib/roles'
import { getSession } from '@/lib/session'
import { listTrackMembership } from '@/lib/track-members'
import { listTracks } from '@/lib/tracks'
import { SignInPrompt } from '@/app/sign-in-prompt'
import { TrackMembershipReview } from './track-membership-review'

/**
 * IDEA-014 — a global Admin sees every track's membership and pending
 * requests; a Track Admin sees only the track(s) they administer (per
 * roles.ts's adminTrackIds, IDEA-011). Neither role sees this page item at
 * all otherwise (see user-menu.tsx, gated in layout.tsx).
 */
export default async function TrackAdminPage() {
  const session = await getSession()
  if (!session.github) return <SignInPrompt />

  const contributor = await findByGithubId(session.github.id)
  if (!contributor) return <SignInPrompt />

  const allTracks = await listTracks()
  const admin = isAdmin(contributor)
  const ownTrackIds = admin ? null : new Set(await adminTrackIds(contributor.githubId))
  const tracks = admin ? allTracks : allTracks.filter((track) => ownTrackIds!.has(track.id))

  if (tracks.length === 0) {
    return (
      <>
        <h2>Not authorized</h2>
        <p className="subtitle">This page is only available to Track Admins and Admins.</p>
      </>
    )
  }

  const sections = await Promise.all(
    tracks.map(async (track) => ({
      trackSlug: track.slug,
      trackName: track.name,
      members: await listTrackMembership(track.id),
    })),
  )

  return (
    <>
      <h2>Track membership</h2>
      <p className="subtitle">Review join requests and members for {admin ? 'every track' : 'your track(s)'}.</p>
      <TrackMembershipReview sections={sections} />
    </>
  )
}
