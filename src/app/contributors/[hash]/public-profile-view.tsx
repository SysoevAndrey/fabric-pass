import Link from 'next/link'
import { CloseMark, CompanyMark, DiscordMark, EmailMark, GitHubMark, LinkedInMark, StatusMark, TelegramMark } from '@/app/marks'
import { CONTRIBUTOR_STATUS_LABELS } from '@/lib/contributor-status-labels'
import type { PublicProfile } from '@/lib/contributors'

/**
 * Read-only, always — this is never the signed-in contributor's own form
 * (see ContributorForm for that), so there is nothing here to edit and
 * nothing that autosaves. Each contact method is a link only when there's
 * somewhere real to send it: LinkedIn never gets one (see PublicProfile's
 * doc comment — no username/vanity-URL claim to build one from), and a
 * Telegram contact known only by phone shows as plain text rather than a
 * fake "open chat" link a phone number can't actually back.
 *
 * IDEA-038 — the status badge is hardcoded to 'confirmed' rather than a
 * field on PublicProfile: getPublicProfile only ever returns a `confirmed`
 * row (see its own doc comment), so there's no other value this could
 * show, and adding a column just to carry a constant isn't worth it. Shown
 * for badge-shape consistency with the Admin table and search results, per
 * this session's item-2 decision (status only, never completeness, on
 * anyone's profile but your own).
 */
export function PublicProfileView({ profile }: { profile: PublicProfile }) {
  return (
    <>
      <div className="profile-header">
        <h2>{profile.name}</h2>
        <Link href="/" className="icon-button-square" title="Close" aria-label="Close">
          <CloseMark size={16} />
        </Link>
      </div>
      <span className="admin-status admin-status-confirmed" title={`Status: ${CONTRIBUTOR_STATUS_LABELS.confirmed}`}>
        <StatusMark size={13} />
        {CONTRIBUTOR_STATUS_LABELS.confirmed}
      </span>
      {profile.company ? (
        <p className="subtitle subtitle-with-icon">
          <CompanyMark size={14} />
          {profile.company}
        </p>
      ) : null}

      <ul className="contact-list">
        <li>
          <a
            className="link-button brand github"
            href={`https://github.com/${profile.githubLogin}`}
            target="_blank"
            rel="noreferrer"
          >
            <GitHubMark size={16} />@{profile.githubLogin}
          </a>
        </li>
        {profile.emailLabel ? (
          <li>
            <a className="link-button brand email" href={`mailto:${profile.emailLabel}`}>
              <EmailMark size={16} />
              {profile.emailLabel}
            </a>
          </li>
        ) : null}
        {profile.discordId ? (
          <li>
            <a
              className="link-button brand discord"
              href={`https://discord.com/users/${profile.discordId}`}
              target="_blank"
              rel="noreferrer"
            >
              <DiscordMark size={16} />
              {profile.discordLabel}
            </a>
          </li>
        ) : null}
        {profile.telegramUsername ? (
          <li>
            <a
              className="link-button brand telegram"
              href={`https://t.me/${profile.telegramUsername}`}
              target="_blank"
              rel="noreferrer"
            >
              <TelegramMark size={16} />@{profile.telegramUsername}
            </a>
          </li>
        ) : profile.telegramPhone ? (
          <li className="contact-static">
            <TelegramMark size={16} />
            {profile.telegramPhone}
          </li>
        ) : null}
        {profile.linkedinLabel ? (
          <li>
            {/* Styled and sized like the other contact rows, but not a real
                link — LinkedIn's OIDC payload carries no username/vanity-URL
                claim (see PublicProfile's doc comment), so there's nowhere
                to send a click. `.static` drops the pointer cursor the
                shared `.link-button` rule otherwise implies. */}
            <span className="link-button brand linkedin static">
              <LinkedInMark size={16} />
              {profile.linkedinLabel}
            </span>
          </li>
        ) : null}
      </ul>
    </>
  )
}
