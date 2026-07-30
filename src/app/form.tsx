'use client'

import type { ReactNode } from 'react'
import { AutosaveField, CompanyField } from './autosave-field'
import type { Notice } from './auth/notice'
import { Collected } from './collected'
import { DiscordMark, TelegramMark } from './marks'

interface Props {
  telegramLabel: string | null
  discordLabel: string | null
  defaults: { name: string; email: string; company: string }
  emailConfirmedAt: Date | null
  emailConfirmationSentAt: Date | null
  notice?: Notice
}

const EMAIL_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000

/**
 * There's nothing this app's own UI can click to confirm an email — that has
 * to happen from the link sent to the address itself, since that's the
 * whole point of proving the contributor can read mail sent there. Sending
 * is a deliberate click too, not automatic (see contributors.ts's
 * saveEmail): this is a status readout plus a button — "Send" for an
 * address that's never had one go out, "Resend" once it has — mirroring the
 * Link/Re-link buttons below for Telegram and Discord. Hidden entirely once
 * confirmed, since there's nothing left to do.
 */
function EmailConfirmationStatus({
  email,
  confirmedAt,
  sentAt,
}: {
  email: string
  confirmedAt: Date | null
  sentAt: Date | null
}) {
  if (!email) return null
  if (confirmedAt) return <p className="email-status confirmed">✓ Confirmed</p>

  const expired = sentAt ? Date.now() - sentAt.getTime() > EMAIL_CONFIRMATION_TTL_MS : false
  const statusText = !sentAt
    ? 'Not confirmed yet.'
    : expired
      ? 'That confirmation link has expired.'
      : `Check your inbox at ${email} and click the confirmation link we sent.`

  return (
    <div className="provider-field email-confirmation">
      <span className="provider-value muted">{statusText}</span>
      <a className="link-button" href="/auth/resend-confirmation">
        {sentAt ? 'Resend confirmation email' : 'Send confirmation email'}
      </a>
    </div>
  )
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

export function ContributorForm({
  telegramLabel,
  discordLabel,
  defaults,
  emailConfirmedAt,
  emailConfirmationSentAt,
  notice,
}: Props) {
  return (
    <>
      <h2>Contributor Profile</h2>
      <p className="subtitle">Please share your contact details below so other community members can reach you.</p>

      {notice ? <p className={notice.kind}>{notice.message}</p> : null}

      {/* No submit button: every field autosaves on its own (Telegram and
          Discord navigate to their own OAuth flow instead), so this isn't a
          form that gets submitted — it's grouped markup for its labels. */}
      <form onSubmit={(e) => e.preventDefault()}>
        <AutosaveField id="name" field="name" label="Name" placeholder="e.g. John Doe" defaultValue={defaults.name} />
        <AutosaveField id="email" field="email" label="Email" type="email" defaultValue={defaults.email} />
        <EmailConfirmationStatus email={defaults.email} confirmedAt={emailConfirmedAt} sentAt={emailConfirmationSentAt} />
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
