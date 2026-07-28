import { findByGithubId } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { ContributorForm } from './form'

export default async function Page() {
  const session = await getSession()
  const error = session.error

  if (!session.github) {
    return (
      <>
        <h1>Contributor registry</h1>
        <p>Sign in with GitHub to add or update your entry.</p>
        {error ? <p className="error">{error}</p> : null}
        <a className="link-button" href="/auth/github">
          Sign in with GitHub
        </a>
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
      discordLabel={discord.username ?? null}
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
