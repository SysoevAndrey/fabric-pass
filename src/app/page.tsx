import { findByGithubId } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { noticeMessage } from './auth/notice'
import { Collected } from './collected'
import { ContributorForm } from './form'
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
        <a className="link-button primary" href="/auth/github">
          {/* The GitHub mark, inline so the button carries no external request. */}
          <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
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
