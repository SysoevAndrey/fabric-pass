import { DiscordMark, EmailMark, GitHubMark, LinkedInMark, TelegramMark } from '@/app/marks'
import type { PublicProfile } from '@/lib/contributors'

/**
 * Read-only, always — this is never the signed-in contributor's own form
 * (see ContributorForm for that), so there is nothing here to edit and
 * nothing that autosaves. Each contact method is a link only when there's
 * somewhere real to send it: LinkedIn never gets one (see PublicProfile's
 * doc comment — no username/vanity-URL claim to build one from), and a
 * Telegram contact known only by phone shows as plain text rather than a
 * fake "open chat" link a phone number can't actually back.
 */
export function PublicProfileView({ profile }: { profile: PublicProfile }) {
  return (
    <>
      <h2>{profile.name}</h2>
      {profile.company ? <p className="subtitle">{profile.company}</p> : null}

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
