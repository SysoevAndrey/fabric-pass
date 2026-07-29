import { findByGithubId } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { noticeMessage } from './auth/notice'
import { Collected } from './collected'
import { ContributorForm } from './form'
import { GitHubMark } from './marks'
import { SafetyNotice } from './safety-notice'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ searchParams }: PageProps) {
  const session = await getSession()
  const params = await searchParams
  // A one-shot notice from an OAuth redirect, read from the URL rather than
  // the session — a Server Component can't clear a cookie during render, but
  // a query parameter is naturally gone on the next navigation.
  const error = noticeMessage(params.notice, params.provider)

  if (!session.github) {
    return (
      <>
        <h2>Contributor registry</h2>
        <SafetyNotice />
        <p>Sign in with GitHub to add or update your entry.</p>
        {error ? <p className="error">{error}</p> : null}
        <a className="link-button brand github" href="/auth/github">
          <GitHubMark />
          Sign in with GitHub
        </a>
        <Collected />
      </>
    )
  }

  // The row was created (or its login refreshed) the instant GitHub sign-in
  // completed — see lib/contributors's ensureContributor, called from the
  // callback route — and every provider link and typed field autosaves
  // straight into it, so this read is always the row's current state; there
  // is no session-held "not yet saved" layer on top of it any more.
  const existing = await findByGithubId(session.github.id)

  return (
    <ContributorForm
      githubLogin={session.github.login}
      telegramLabel={existing?.telegramUsername ? `@${existing.telegramUsername}` : (existing?.telegramPhone ?? null)}
      discordLabel={existing?.discordUsername ?? null}
      defaults={{
        name: existing?.name ?? '',
        email: existing?.email ?? '',
        company: existing?.company ?? '',
      }}
      error={error}
    />
  )
}
