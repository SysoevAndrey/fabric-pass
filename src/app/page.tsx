import { redirect } from 'next/navigation'
import { findByGithubId } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { noticeKind, noticeMessage, REAUTH_REQUIRED_MESSAGE, type Notice } from './auth/notice'
import { SignInPrompt } from './sign-in-prompt'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Main — IDEA-001's static root page. Signed-out visitors (or a session
 * naming a github_id with no row — see README's "session outlives its row")
 * still get the same GitHub sign-in prompt this page always showed. A
 * signed-in contributor with a row has nothing of its own to show yet, so
 * this redirects to `/profile` — carrying over `notice`/`provider` when
 * present, since a one-shot notice from the GitHub sign-in itself
 * (`?notice=expired`/`link-failed` etc.) is still routed at Main and needs
 * somewhere to land. Once Main has real content this redirect goes away.
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

  const query = new URLSearchParams()
  if (typeof params.notice === 'string') query.set('notice', params.notice)
  if (typeof params.provider === 'string') query.set('provider', params.provider)
  redirect(query.size > 0 ? `/profile?${query.toString()}` : '/profile')
}
