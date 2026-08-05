import { redirect } from 'next/navigation'
import { findByGithubId } from '@/lib/contributors'
import { isProfileComplete } from '@/lib/profile-completeness'
import { getSession } from '@/lib/session'
import { noticeKind, noticeMessage, REAUTH_REQUIRED_MESSAGE, type Notice } from './auth/notice'
import { ContributorSearch } from './contributor-search'
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

  return (
    <>
      <h2>Constructor Fabric Pass</h2>
      {notice ? <p className={notice.kind}>{notice.message}</p> : null}
      <ContributorSearch />
    </>
  )
}
