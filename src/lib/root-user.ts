import { env } from '@/lib/env'

/**
 * True only when this app has a root user configured (`ROOT_GITHUB_ID`) and
 * `githubId` names that one. Derived entirely from config — never stored in
 * the `contributors` table, never exported to the cf-internal registry.
 * Groundwork for IDEA-011's Contributor/Track Admin/Admin roles; nothing
 * calls this yet.
 */
export function isRootUser(githubId: string): boolean {
  return env.ROOT_GITHUB_ID !== undefined && env.ROOT_GITHUB_ID === githubId
}
