import Link from 'next/link'

interface Props {
  profileComplete: boolean
  trackMembership: 'none' | 'pending' | 'approved'
}

/**
 * IDEA-015 — ties together three pieces that already exist separately:
 * completing the profile (IDEA-000's original name+email bar — always true
 * by the time this renders, see page.tsx's caller for why that's still
 * useful to show), reading the community policies (IDEA-006, no
 * read-tracking exists so this step is always just a link, never shown
 * "done"), and requesting to join a track (IDEA-013), whose three states —
 * not started / pending / done-once-approved — mirror what the track page
 * itself shows the requester (join-track.tsx). The panel itself only shows
 * at all while IDEA-034's richer completeness is short of Complete.
 */
export function OnboardingChecklist({ profileComplete, trackMembership }: Props) {
  return (
    <div className="onboarding-checklist">
      <h3>Getting started</h3>
      <ul>
        <li className={profileComplete ? 'onboarding-step-done' : undefined}>
          <Link href="/profile">Complete your profile</Link>
          {profileComplete ? <span className="onboarding-step-status">Done</span> : null}
        </li>
        <li>
          <Link href="/policies">Read the community policies</Link>
        </li>
        <li className={trackMembership === 'approved' ? 'onboarding-step-done' : undefined}>
          <Link href="/tracks">Request to join a track</Link>
          {trackMembership === 'approved' ? <span className="onboarding-step-status">Done</span> : null}
          {trackMembership === 'pending' ? <span className="onboarding-step-status">Pending approval</span> : null}
        </li>
      </ul>
    </div>
  )
}
