import { getAppConfig } from '@/lib/app-config'
import { markDiscordInvited, markGithubOrgInvited, type Contributor } from '@/lib/contributors'
import { sendDiscordInviteEmail } from '@/lib/email'
import { inviteToGitHubOrg } from '@/lib/github-org'

/**
 * IDEA-041 — called from admin/actions.ts's setContributorStatusAction
 * right after a contributor is confirmed. Best-effort and never throws:
 * Confirm itself has already succeeded by the time this runs, and neither
 * a missing config, a missing credential, nor a failed GitHub/email call
 * should read as if Confirm failed.
 *
 * GitHub: a real org invite via the API (see github-org.ts) — the
 * contributor still has to accept it themselves, same as any GitHub org
 * invite. Discord: there's no API that silently adds someone to a guild
 * (see providers/discord.ts's module doc — this app only ever requested
 * the `identify` scope and never persisted an access token for any
 * provider), so this sends an email containing cf-internal's configured
 * invite link instead — "automatically invited," not "automatically
 * joined."
 *
 * Each half is independently gated on its own config value being present
 * (`githubOrganization`/`discordInviteUrl` from pass/config.yaml) — a
 * deploy can have one configured without the other. The timestamp is
 * stamped whenever that config-level precondition is met, regardless of
 * whether GITHUB_ORG_TOKEN is actually set — inviteToGitHubOrg itself
 * no-ops and logs when the token is missing, so nothing unsafe happens,
 * but the Admin list's Re-invite button won't appear until the org name
 * itself is configured at all.
 */
export async function inviteConfirmedContributor(contributor: Contributor): Promise<void> {
  try {
    const config = await getAppConfig()
    if (!config) return

    if (config.githubOrganization) {
      await inviteToGitHubOrg(contributor.githubLogin, config.githubOrganization)
      await markGithubOrgInvited(contributor.githubId)
    }

    if (config.discordInviteUrl && contributor.email) {
      await sendDiscordInviteEmail(contributor.email, config.discordInviteUrl)
      await markDiscordInvited(contributor.githubId)
    }
  } catch (error) {
    console.error(`inviteConfirmedContributor(${contributor.githubId}) failed:`, error)
  }
}
