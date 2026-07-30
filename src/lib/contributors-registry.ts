import { parse, stringify } from 'yaml'
import { z } from 'zod'
import { isContributorStatus, type Contributor, type StatusUpdate } from '@/lib/contributors'

/**
 * The shape written to and read from cf-internal's pass/contributors.yaml.
 * Every field except `status` is owned by this app and overwritten on each
 * export — see the module doc below. `github_id` is quoted on the way out
 * (an explicit string, not a bare YAML int) for the same reason it's `text`
 * in Postgres: a real production id has already overflowed a 64-bit integer
 * once (see migrations/003_telegram_id_as_text.sql's telegram_id, the same
 * shape of bug).
 */
interface RegistryRow {
  github_id: string
  github_login: string
  name: string | null
  email: string | null
  company: string | null
  telegram_username: string | null
  telegram_phone: string | null
  discord_username: string | null
  status: string
}

/**
 * DB → YAML. Every contact field is written fresh from the database on
 * every export — this app is their only writer, so there's nothing to
 * preserve from the previous file content. `status` is the one field NOT
 * owned here: it's read from the DB only because the DB is itself already a
 * synced mirror of the file's own last `status` (see
 * contributors.ts#syncContributorStatuses), not because this export is
 * where status originates.
 */
export function toRegistryYaml(contributors: Contributor[]): string {
  const rows: RegistryRow[] = contributors.map((contributor) => ({
    github_id: contributor.githubId,
    github_login: contributor.githubLogin,
    name: contributor.name ?? null,
    email: contributor.email ?? null,
    company: contributor.company ?? null,
    telegram_username: contributor.telegramUsername ?? null,
    telegram_phone: contributor.telegramPhone ?? null,
    discord_username: contributor.discordUsername ?? null,
    status: contributor.status,
  }))
  return stringify({ contributors: rows })
}

const registryRowSchema = z.object({
  // Accepts a bare YAML integer too — an admin hand-editing the file is not
  // guaranteed to keep the quotes this app always writes — and normalizes
  // either shape to a string before it ever reaches a query parameter.
  github_id: z.union([z.string(), z.number()]).transform(String),
  status: z.string(),
})

const registryFileSchema = z.object({
  contributors: z.array(z.unknown()).default([]),
})

/**
 * YAML → status updates. Only `github_id` and `status` are read — every
 * other column in the file is this app's own last export, round-tripped by
 * whatever wrote the file, and not a value this app should ever adopt back
 * in (see the module doc above). A row failing validation (missing
 * `github_id`, or a `status` outside CONTRIBUTOR_STATUSES) is dropped, not
 * thrown on: one malformed hand-edit shouldn't block every other row's
 * status from syncing.
 */
export function parseRegistryYaml(content: string): { updates: StatusUpdate[]; invalidRowCount: number } {
  const parsed = registryFileSchema.parse(parse(content) ?? {})
  const updates: StatusUpdate[] = []
  let invalidRowCount = 0

  for (const raw of parsed.contributors) {
    const row = registryRowSchema.safeParse(raw)
    if (!row.success || !isContributorStatus(row.data.status)) {
      invalidRowCount += 1
      continue
    }
    updates.push({ githubId: row.data.github_id, status: row.data.status })
  }

  return { updates, invalidRowCount }
}
