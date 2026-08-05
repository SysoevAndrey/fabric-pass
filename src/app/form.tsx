'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { AutosaveField, CompanyField, EmailField } from './autosave-field'
import type { Notice } from './auth/notice'
import { Collected } from './collected'
import { missingMandatoryFields } from '@/lib/profile-completeness'
import { CloseMark, DiscordMark, LinkedInMark, PencilMark, TelegramMark } from './marks'

interface Props {
  telegramLabel: string | null
  discordLabel: string | null
  linkedinLabel: string | null
  /** LinkedIn is this app's only optional provider (see lib/env.ts) — the
   * row is left out of the form entirely, not shown disabled, when it isn't
   * configured for this environment. */
  linkedinEnabled: boolean
  defaults: { name: string; email: string; company: string }
  emailConfirmedAt: Date | null
  emailConfirmationSentAt: Date | null
  notice?: Notice
  /** Profile opens straight into edit mode when the caller (currently
   * profile/page.tsx, keyed off isProfileComplete) decides there's nothing
   * meaningful to show in view mode yet. Defaults to view mode, unchanged
   * from slice 1. */
  initialEditing?: boolean
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
  editable,
}: {
  label: string
  value: string | null
  href: string
  brand: 'telegram' | 'discord' | 'linkedin'
  mark: ReactNode
  /** View mode's gate on Link/Re-link: the action is left out of the markup
   * entirely rather than rendered disabled, since there's nothing to click
   * through to in view mode anyway. */
  editable: boolean
}) {
  return (
    <>
      <label>{label}</label>
      <div className="provider-field">
        <span className={value ? 'provider-value' : 'provider-value muted'}>{value ?? 'Not linked'}</span>
        {editable ? (
          <a className={`link-button brand ${brand}`} href={href}>
            {mark}
            {value ? 'Re-link' : 'Link'}
          </a>
        ) : null}
      </div>
    </>
  )
}

export function ContributorForm({
  telegramLabel,
  discordLabel,
  linkedinLabel,
  linkedinEnabled,
  defaults,
  emailConfirmedAt,
  emailConfirmationSentAt,
  notice,
  initialEditing = false,
}: Props) {
  // View-only on load by default, so a returning contributor can't change
  // anything by accident — Edit switches this on, Save switches it back off.
  // `name`/`email` mirror the two mandatory fields' live values, kept only so
  // Save can check them; they never drive persistence themselves (each
  // field's own autosave does that, unchanged).
  const router = useRouter()
  const [editing, setEditing] = useState(initialEditing)
  const [name, setName] = useState(defaults.name)
  const [email, setEmail] = useState(defaults.email)
  const [company, setCompany] = useState(defaults.company)
  const [saveMessage, setSaveMessage] = useState<string>()

  // Save leaves Profile entirely, back to Main — unlike Close (below), which
  // only backs out of edit mode without navigating anywhere. Every field has
  // already autosaved by the time Save is pressed; this is "I'm done," not
  // "commit my changes" (there's nothing left to commit). Discord has no
  // live client-side state of its own (it only changes via a full-page OAuth
  // redirect back to this same page), so discordLabel — the prop, already
  // current as of the last render — stands in directly.
  function handleSave() {
    const missing = missingMandatoryFields({ name, email, company, discordUsername: discordLabel ?? undefined })
    if (missing.length > 0) {
      setSaveMessage(`Please fill in: ${missing.join(', ')}.`)
      return
    }
    setSaveMessage(undefined)
    router.push('/')
  }

  // Unlike Save, Close skips missingMandatoryFields — every field autosaves
  // individually as it's typed, so there is nothing to lose by backing out
  // of edit mode without validating, and clears saveMessage so a stale
  // validation error from a prior Save attempt doesn't linger into view mode.
  function handleClose() {
    setSaveMessage(undefined)
    setEditing(false)
  }

  return (
    <>
      <div className="profile-header">
        <h2>Contributor Profile</h2>
        {/* View mode only — edit mode's actions live at the bottom of the
            form instead (Save/Cancel, below). Icon-only so the pair reads
            as a matched set of squared controls rather than one CTA-shaped
            button; the title/aria-label carry the "Edit"/"Close" hint. */}
        {editing ? null : (
          <div className="profile-header-actions">
            <button
              type="button"
              className="icon-button-square"
              title="Edit"
              aria-label="Edit"
              onClick={() => setEditing(true)}
            >
              <PencilMark size={16} />
            </button>
            <button
              type="button"
              className="icon-button-square"
              title="Close"
              aria-label="Close"
              onClick={() => router.push('/')}
            >
              <CloseMark size={16} />
            </button>
          </div>
        )}
      </div>
      <p className="subtitle">Please share your contact details below to make it easier for other community members to reach you and for us to grant you access to relevant community resources.</p>

      {notice ? <p className={notice.kind}>{notice.message}</p> : null}
      {saveMessage ? <p className="error" role="alert">{saveMessage}</p> : null}

      {/* No submit button: every field autosaves on its own (Telegram and
          Discord navigate to their own OAuth flow instead), so this isn't a
          form that gets submitted — it's grouped markup for its labels. */}
      <form onSubmit={(e) => e.preventDefault()}>
        <AutosaveField
          id="name"
          field="name"
          label="Full Name"
          placeholder="e.g. John Doe"
          defaultValue={defaults.name}
          disabled={!editing}
          onValueChange={setName}
        />
        <EmailField
          id="email"
          defaultValue={defaults.email}
          confirmedAt={emailConfirmedAt}
          sentAt={emailConfirmationSentAt}
          disabled={!editing}
          onValueChange={setEmail}
        />
        <CompanyField defaultValue={defaults.company} disabled={!editing} onValueChange={setCompany} />
        <ProviderField
          label="Discord"
          value={discordLabel}
          href="/auth/discord"
          brand="discord"
          mark={<DiscordMark size={16} />}
          editable={editing}
        />
        <ProviderField
          label="Telegram"
          value={telegramLabel}
          href="/auth/telegram"
          brand="telegram"
          mark={<TelegramMark size={16} />}
          editable={editing}
        />
        {linkedinEnabled ? (
          <ProviderField
            label="LinkedIn"
            value={linkedinLabel}
            href="/auth/linkedin"
            brand="linkedin"
            mark={<LinkedInMark size={16} />}
            editable={editing}
          />
        ) : null}
      </form>

      {/* Bottom of the form rather than the header (view mode's spot) —
          these commit/discard the whole editing session, so they read as
          the form's own actions rather than a page-level toggle. */}
      {editing ? (
        <div className="form-actions">
          <button type="button" className="button-primary" onClick={handleSave}>
            Save
          </button>
          <button type="button" className="button-secondary" onClick={handleClose}>
            Cancel
          </button>
        </div>
      ) : null}

      <Collected />
    </>
  )
}
