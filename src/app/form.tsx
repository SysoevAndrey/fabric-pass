'use client'

import type { ReactNode } from 'react'
import { AutosaveField, CompanyField } from './autosave-field'
import { Collected } from './collected'
import { DiscordMark, TelegramMark } from './marks'

interface Props {
  telegramLabel: string | null
  discordLabel: string | null
  defaults: { name: string; email: string; company: string }
  error?: string
}

/**
 * Telegram and Discord aren't typed text, so they can't be an <input> — this
 * gives them the same label-above-field shape as the autosaving fields below
 * instead (see globals.css's `.provider-field`), rather than the separate,
 * differently-styled button row this used to be.
 */
function ProviderField({
  label,
  value,
  href,
  brand,
  mark,
}: {
  label: string
  value: string | null
  href: string
  brand: 'telegram' | 'discord'
  mark: ReactNode
}) {
  return (
    <>
      <label>{label}</label>
      <div className="provider-field">
        <span className={value ? 'provider-value' : 'provider-value muted'}>{value ?? 'Not linked'}</span>
        <a className={`link-button brand ${brand}`} href={href}>
          {mark}
          {value ? 'Re-link' : 'Link'}
        </a>
      </div>
    </>
  )
}

export function ContributorForm({ telegramLabel, discordLabel, defaults, error }: Props) {
  return (
    <>
      <h2>Contributor Profile</h2>
      <p className="subtitle">Please share your contact details below so other community members can reach you.</p>

      {error ? <p className="error">{error}</p> : null}

      {/* No submit button: every field autosaves on its own (Telegram and
          Discord navigate to their own OAuth flow instead), so this isn't a
          form that gets submitted — it's grouped markup for its labels. */}
      <form onSubmit={(e) => e.preventDefault()}>
        <AutosaveField id="name" field="name" label="Name" placeholder="e.g. John Doe" defaultValue={defaults.name} />
        <AutosaveField id="email" field="email" label="Email" type="email" defaultValue={defaults.email} />
        <CompanyField defaultValue={defaults.company} />
        <ProviderField
          label="Discord"
          value={discordLabel}
          href="/auth/discord"
          brand="discord"
          mark={<DiscordMark size={16} />}
        />
        <ProviderField
          label="Telegram"
          value={telegramLabel}
          href="/auth/telegram"
          brand="telegram"
          mark={<TelegramMark size={16} />}
        />
      </form>

      <Collected />
    </>
  )
}
