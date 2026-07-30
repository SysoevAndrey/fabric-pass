'use client'

import { AutosaveField, CompanyField } from './autosave-field'
import { Collected } from './collected'
import { DiscordMark, TelegramMark } from './marks'

interface Props {
  githubLogin: string
  telegramLabel: string | null
  discordLabel: string | null
  defaults: { name: string; email: string; company: string }
  error?: string
}

export function ContributorForm({ githubLogin, telegramLabel, discordLabel, defaults, error }: Props) {
  return (
    <>
      <h2>Constructor Fabric Pass</h2>
      <p>
        Signed in as <strong>@{githubLogin}</strong>
      </p>
      <p className="subtitle">Please share your contact details below so other community members can reach you.</p>

      {error ? <p className="error">{error}</p> : null}

      <ul className="links">
        <li>
          {/* The label is rendered even when nothing is linked, so every row's
              button starts at the same x rather than sliding left. */}
          <span className="linked">Telegram: {telegramLabel ?? 'not linked'}</span>
          <a className="link-button brand telegram" href="/auth/telegram">
            <TelegramMark />
            {telegramLabel ? 'Re-link Telegram' : 'Link Telegram'}
          </a>
        </li>
        <li>
          <span className="linked">Discord: {discordLabel ?? 'not linked'}</span>
          <a className="link-button brand discord" href="/auth/discord">
            <DiscordMark />
            {discordLabel ? 'Re-link Discord' : 'Link Discord'}
          </a>
        </li>
      </ul>

      {/* No submit button: every field autosaves on its own, so this isn't a
          form that gets submitted — it's grouped markup for its labels. */}
      <form onSubmit={(e) => e.preventDefault()}>
        <AutosaveField id="name" field="name" label="Name" placeholder="e.g. John Doe" defaultValue={defaults.name} />
        <AutosaveField id="email" field="email" label="Email" type="email" defaultValue={defaults.email} />
        <CompanyField defaultValue={defaults.company} />
      </form>

      <Collected />
    </>
  )
}
