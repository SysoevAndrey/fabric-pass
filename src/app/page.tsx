import { findByGithubId } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { noticeMessage } from './auth/notice'
import { Collected } from './collected'
import { ContributorForm } from './form'
import { GitHubMark } from './marks'
import { isUnsaved } from './pending-link'

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

  const existing = await findByGithubId(session.github.id)
  const telegram = session.pending?.telegram ?? {
    providerId: existing?.telegramId ?? '',
    username: existing?.telegramUsername,
    phone: existing?.telegramPhone,
  }
  const discord = session.pending?.discord ?? {
    providerId: existing?.discordId ?? '',
    username: existing?.discordUsername,
  }

  return (
    <ContributorForm
      githubLogin={session.github.login}
      telegramLabel={telegram.username ? `@${telegram.username}` : (telegram.phone ?? null)}
      telegramUnsaved={isUnsaved(session.pending?.telegram, existing?.telegramId)}
      discordLabel={discord.username ?? null}
      discordUnsaved={isUnsaved(session.pending?.discord, existing?.discordId)}
      defaults={{
        firstName: existing?.firstName ?? '',
        lastName: existing?.lastName ?? '',
        email: existing?.email ?? '',
        company: existing?.company ?? '',
      }}
      error={error}
    />
  )
}
