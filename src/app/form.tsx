'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { save } from './actions'
import { Collected } from './collected'
import { DiscordMark, TelegramMark } from './marks'
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

  // A failed submission's values take over as the fields' defaultValue, so
  // when React resets the (uncontrolled) form after the action settles, it
  // resets to what the contributor typed rather than the original,
  // database-loaded defaults.
  const shown = result.values ?? defaults

  // Company is the one controlled field: its clear button has to empty it, and
  // an uncontrolled input keeps the value React last wrote from defaultValue.
  // The effect re-seeds it when `shown` changes — the moment React resets the
  // form after an action settles.
  const companyRef = useRef<HTMLInputElement>(null)
  const [company, setCompany] = useState(shown.company)
  useEffect(() => setCompany(shown.company), [shown.company])

  if (result.ok) {
    return (
      <>
        <h2>Thanks — you are on the list</h2>
        <p>Your entry has been saved. You can come back to this page any time to change it.</p>
        <a className="link-button" href="/">
          Edit my entry
        </a>
      </>
    )
  }

  return (
    <>
      <h2>Contributor registry</h2>
      <p>
        Signed in as <strong>@{githubLogin}</strong>
      </p>

      {error ? <p className="error">{error}</p> : null}
      {result.message ? <p className="error">{result.message}</p> : null}

      <ul className="links">
        <li>
          {/* The label is rendered even when nothing is linked, so every row's
              button starts at the same x rather than sliding left. */}
          <span className="linked">Telegram: {telegramLabel ?? 'not linked'}</span>
          <a className="link-button brand telegram" href="/auth/telegram">
            <TelegramMark />
            {telegramLabel ? 'Re-link Telegram' : 'Link Telegram'}
          </a>
          {telegramUnsaved ? <span className="pending">not yet saved, press Save to record it</span> : null}
        </li>
        <li>
          <span className="linked">Discord: {discordLabel ?? 'not linked'}</span>
          <a className="link-button brand discord" href="/auth/discord">
            <DiscordMark />
            {discordLabel ? 'Re-link Discord' : 'Link Discord'}
          </a>
          {discordUnsaved ? <span className="pending">not yet saved, press Save to record it</span> : null}
        </li>
      </ul>

      <form action={formAction}>
        <label htmlFor="firstName">First name</label>
        <input id="firstName" name="firstName" defaultValue={shown.firstName} required />

        <label htmlFor="lastName">Last name</label>
        <input id="lastName" name="lastName" defaultValue={shown.lastName} required />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" defaultValue={shown.email} required />

        <label htmlFor="company">Company</label>
        {/* A datalist rather than a select: the three companies are the common
            answers, but a contributor from anywhere else must still be able to
            type their own — and unlike a select plus a conditional text field,
            this keeps working without JavaScript. */}
        <div className={company ? 'clearable filled' : 'clearable'}>
          <input
            id="company"
            name="company"
            // The datalist is what makes the browser draw its own dropdown
            // arrow, and no CSS hides that arrow across browsers. Dropping the
            // attribute once the field holds a value removes it outright; the
            // suggestions are there for an empty field, which is when they help.
            list={company ? undefined : 'companies'}
            ref={companyRef}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          {company ? (
            <button
              type="button"
              className="clear"
              aria-label="Clear company"
              onClick={() => {
                setCompany('')
                companyRef.current?.focus()
              }}
            >
              ×
            </button>
          ) : null}
        </div>
        <datalist id="companies">
          <option value="Constructor" />
          <option value="Acronis" />
          <option value="Virtuozzo" />
        </datalist>

        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </form>

      <Collected />
    </>
  )
}
