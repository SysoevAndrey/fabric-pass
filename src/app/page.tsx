import { findByGithubId, resolveProviderLabels } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { noticeKind, noticeMessage, REAUTH_REQUIRED_MESSAGE, type Notice } from './auth/notice'
import { ContributorForm } from './form'
import { GitHubMark } from './marks'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * The GitHub sign-in prompt: shown both when nobody is signed in yet, and
 * when the session cookie names a github_id no longer in the table (see
 * README's "session outlives its row") — the same action, signing in with
 * GitHub again, recovers from both, since it recreates the row.
 */
function SignInPrompt({ notice }: { notice?: Notice }) {
  return (
    <>
      <h2>Sign In</h2>
      <p className="subtitle">Sign in with GitHub to add or update your profile.</p>
      {notice ? <p className={notice.kind}>{notice.message}</p> : null}
      <a className="link-button brand github" href="/auth/github">
        <GitHubMark />
        Sign in with GitHub
      </a>
    </>
  )
}

export default async function Page({ searchParams }: PageProps) {
  const session = await getSession()
  const params = await searchParams
  // A one-shot notice from an OAuth redirect, read from the URL rather than
  // the session — a Server Component can't clear a cookie during render, but
  // a query parameter is naturally gone on the next navigation.
  const message = noticeMessage(params.notice, params.provider)
  const notice: Notice | undefined = message ? { message, kind: noticeKind(params.notice) } : undefined

  if (!session.github) {
    return <SignInPrompt notice={notice} />
  }

  // The row was created (or its login refreshed) the instant GitHub sign-in
  // completed — see lib/contributors's ensureContributor, called from the
  // callback route — and every provider link and typed field autosaves
  // straight into it, so this read is always the row's current state; there
  // is no session-held "not yet saved" layer on top of it any more.
  const existing = await findByGithubId(session.github.id)

  if (!existing) {
    // The cookie outlived its row — deleted out from under a live session
    // (see README's "session outlives its row"). There is nothing here to
    // bind a form to, and no in-page action other than signing in again can
    // fix it, so this reads the same as being signed out rather than
    // rendering a form bound to a row that no longer exists.
    return <SignInPrompt notice={{ message: REAUTH_REQUIRED_MESSAGE, kind: 'error' }} />
  }

  const { telegramLabel, discordLabel } = await resolveProviderLabels(existing)

  return (
    <ContributorForm
      telegramLabel={telegramLabel}
      discordLabel={discordLabel}
      defaults={{
        name: existing.name ?? '',
        email: existing.email ?? '',
        company: existing.company ?? '',
      }}
      emailConfirmedAt={existing.emailConfirmedAt ?? null}
      emailConfirmationSentAt={existing.emailConfirmationSentAt ?? null}
      notice={notice}
    />
  )
}
