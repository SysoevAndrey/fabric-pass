'use client'

import { useActionState } from 'react'
import { save } from './actions'
import type { SaveResult } from './form-schema'

interface Props {
  githubLogin: string
  telegramLabel: string | null
  /** True when the shown Telegram link exists only in this session, not yet in the saved row. */
  telegramUnsaved: boolean
  discordLabel: string | null
  /** True when the shown Discord link exists only in this session, not yet in the saved row. */
  discordUnsaved: boolean
  defaults: { firstName: string; lastName: string; email: string; company: string }
  error?: string
}

const initial: SaveResult = { ok: false }

export function ContributorForm({
  githubLogin,
  telegramLabel,
  telegramUnsaved,
  discordLabel,
  discordUnsaved,
  defaults,
  error,
}: Props) {
  const [result, formAction, pending] = useActionState(save, initial)

  if (result.ok) {
    return (
      <>
        <h1>Thanks — you are on the list</h1>
        <p>Your entry has been saved. You can come back to this page any time to change it.</p>
        <a className="link-button" href="/">
          Edit my entry
        </a>
      </>
    )
  }

  // A failed submission's values take over as the fields' defaultValue, so
  // when React resets the (uncontrolled) form after the action settles, it
  // resets to what the contributor typed rather than the original,
  // database-loaded defaults.
  const shown = result.values ?? defaults

  return (
    <>
      <h1>Contributor registry</h1>
      <p>
        Signed in as <strong>@{githubLogin}</strong>
      </p>

      {error ? <p className="error">{error}</p> : null}
      {result.message ? <p className="error">{result.message}</p> : null}

      <p>
        {telegramLabel ? (
          <span className="linked">
            Telegram: {telegramLabel}
            {telegramUnsaved ? <span className="pending"> — not yet saved, press Save to record it</span> : null} ·{' '}
          </span>
        ) : null}
        <a className="link-button" href="/auth/telegram">
          {telegramLabel ? 'Re-link Telegram' : 'Link Telegram'}
        </a>
        {discordLabel ? (
          <span className="linked">
            Discord: {discordLabel}
            {discordUnsaved ? <span className="pending"> — not yet saved, press Save to record it</span> : null} ·{' '}
          </span>
        ) : null}
        <a className="link-button" href="/auth/discord">
          {discordLabel ? 'Re-link Discord' : 'Link Discord'}
        </a>
      </p>

      <form action={formAction}>
        <label htmlFor="firstName">First name</label>
        <input id="firstName" name="firstName" defaultValue={shown.firstName} required />

        <label htmlFor="lastName">Last name</label>
        <input id="lastName" name="lastName" defaultValue={shown.lastName} required />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" defaultValue={shown.email} required />

        <label htmlFor="company">Company (optional)</label>
        <input id="company" name="company" defaultValue={shown.company} />

        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </>
  )
}
