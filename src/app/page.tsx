import Link from 'next/link'
import { redirect } from 'next/navigation'
import { findByGithubId } from '@/lib/contributors'
import { isProfileComplete } from '@/lib/profile-completeness'
import { getSession } from '@/lib/session'
import { anyMembershipSummary } from '@/lib/track-members'
import { noticeKind, noticeMessage, REAUTH_REQUIRED_MESSAGE, type Notice } from './auth/notice'
import { ContributorSearch } from './contributor-search'
import { OnboardingChecklist } from './onboarding-checklist'
import { SignInPrompt } from './sign-in-prompt'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Main — IDEA-001's root page, restored to its originally-designed
 * conditional redirect now that IDEA-005 gives it real content (search) to
 * show: a contributor whose profile isn't complete yet has nothing useful
 * to search with, so they still land on /profile in edit mode first, same
 * as right after signing in. Only once the profile is complete does Main
 * actually render instead of redirecting — carrying over `notice`/
 * `provider` on the redirect either way, since a one-shot notice from the
 * GitHub sign-in itself (`?notice=expired`/`link-failed` etc.) is routed at
 * Main and needs somewhere to land.
 */
export default async function Page({ searchParams }: PageProps) {
  const session = await getSession()
  const params = await searchParams
  const message = noticeMessage(params.notice, params.provider)
  const notice: Notice | undefined = message ? { message, kind: noticeKind(params.notice) } : undefined

  if (!session.github) {
    return <SignInPrompt notice={notice} />
  }

  const existing = await findByGithubId(session.github.id)
  if (!existing) {
    return <SignInPrompt notice={{ message: REAUTH_REQUIRED_MESSAGE, kind: 'error' }} />
  }

  if (!isProfileComplete(existing)) {
    const query = new URLSearchParams()
    if (typeof params.notice === 'string') query.set('notice', params.notice)
    if (typeof params.provider === 'string') query.set('provider', params.provider)
    redirect(query.size > 0 ? `/profile?${query.toString()}` : '/profile')
  }

  // IDEA-015's checklist stays visible until IDEA-034's full completeness
  // (mandatory fields + confirmed email + optional Telegram/LinkedIn) —
  // deliberately richer than the name+email check just above that gates
  // reaching Main at all, since every viewer of this page already passes
  // that narrower check and gating the checklist on it too would make it
  // vanish immediately for everyone. IDEA-034's own notes explicitly
  // anticipate this checklist reusing its richer completeness for exactly
  // this. Its "complete profile" step, though, still reports the original,
  // narrower isProfileComplete (name+email — literally what IDEA-015 asked
  // for) — always true by the time this renders, which correctly shows a
  // contributor they've already cleared that bar and have two steps left.
  const showChecklist = existing.profileCompleteness !== 'complete'
  const trackMembership = showChecklist ? await anyMembershipSummary(existing.githubId) : 'none'

  return (
    <>
      <h2>Constructor Fabric Pass</h2>
      {notice ? <p className={notice.kind}>{notice.message}</p> : null}
      <ContributorSearch />
      {/* IDEA-006/007 — linked from Main rather than embedded inline, so
          Main stays focused on search; reuses the footer's own link
          styling (.footer-links) rather than a new nav treatment. */}
      <ul className="footer-links main-quick-links">
        <li>
          <Link href="/tracks">Browse tracks →</Link>
        </li>
        <li>
          <Link href="/policies">Community policies →</Link>
        </li>
      </ul>
      {showChecklist ? <OnboardingChecklist profileComplete={isProfileComplete(existing)} trackMembership={trackMembership} /> : null}
    </>
  )
}
