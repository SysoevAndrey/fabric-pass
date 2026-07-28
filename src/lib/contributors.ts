import { pool } from '@/lib/db'

export interface ContributorInput {
  githubId: string
  githubLogin: string
  telegramId?: string
  telegramUsername?: string
  telegramPhone?: string
  discordId?: string
  discordUsername?: string
  firstName: string
  lastName: string
  email: string
  company?: string
}

export interface Contributor extends ContributorInput {
  id: string
  createdAt: Date
  updatedAt: Date
}

export class AccountAlreadyLinkedError extends Error {
  constructor(readonly provider: 'telegram' | 'discord') {
    super(`This ${provider} account is already linked to another contributor.`)
    this.name = 'AccountAlreadyLinkedError'
  }
}

interface Row {
  id: string
  github_id: string
  github_login: string
  telegram_id: string | null
  telegram_username: string | null
  telegram_phone: string | null
  discord_id: string | null
  discord_username: string | null
  first_name: string
  last_name: string
  email: string
  company: string | null
  created_at: Date
  updated_at: Date
}

/** `pg` hands back bigint as string and NULL as null; the domain type uses undefined. */
function toContributor(row: Row): Contributor {
  return {
    id: row.id,
    githubId: row.github_id,
    githubLogin: row.github_login,
    telegramId: row.telegram_id ?? undefined,
    telegramUsername: row.telegram_username ?? undefined,
    telegramPhone: row.telegram_phone ?? undefined,
    discordId: row.discord_id ?? undefined,
    discordUsername: row.discord_username ?? undefined,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    company: row.company ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function findByGithubId(githubId: string): Promise<Contributor | null> {
  const { rows } = await pool.query<Row>('SELECT * FROM contributors WHERE github_id = $1', [githubId])
  return rows[0] ? toContributor(rows[0]) : null
}

/**
 * One statement, so concurrent submissions cannot race: there is no
 * read-modify-write cycle to interleave. The caller no longer reads the row
 * first, so each provider's whole field group — telegram_id/username/phone
 * together, discord_id/username together — is kept or replaced as a unit,
 * keyed off whether *that provider's id* was supplied this save:
 *
 *   - a new telegram_id  -> all three telegram_* columns come from EXCLUDED,
 *     including any NULLs, so a field left over from a *different* linked
 *     account (e.g. an old phone number, once a new id brings a username)
 *     cannot survive beside it.
 *   - no telegram_id (omitted this save) -> all three are preserved as they
 *     were, because nothing about that link changed.
 *
 * Per-column COALESCE alone breaks this: telegram_username and
 * telegram_phone are mutually exclusive by construction (toIdentity returns
 * one or the other, never both), so linking phone-first and later
 * re-linking a different account that has a username would otherwise leave
 * the old phone number stored beside the new username — a stale, no-longer-
 * true fact the project has no basis to hold. Discord's username is grouped
 * with its id the same way.
 *
 * There is still deliberately no way to unlink a provider entirely at the
 * SQL level (no id at all clears nothing); the caller already had no way to
 * express that either.
 */
export async function upsert(input: ContributorInput): Promise<Contributor> {
  try {
    const { rows } = await pool.query<Row>(
      `INSERT INTO contributors (
         github_id, github_login, telegram_id, telegram_username, telegram_phone,
         discord_id, discord_username, first_name, last_name, email, company
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (github_id) DO UPDATE SET
         github_login      = EXCLUDED.github_login,
         telegram_id       = COALESCE(EXCLUDED.telegram_id, contributors.telegram_id),
         telegram_username = CASE WHEN EXCLUDED.telegram_id IS NOT NULL
                                THEN EXCLUDED.telegram_username ELSE contributors.telegram_username END,
         telegram_phone    = CASE WHEN EXCLUDED.telegram_id IS NOT NULL
                                THEN EXCLUDED.telegram_phone ELSE contributors.telegram_phone END,
         discord_id        = COALESCE(EXCLUDED.discord_id, contributors.discord_id),
         discord_username  = CASE WHEN EXCLUDED.discord_id IS NOT NULL
                                THEN EXCLUDED.discord_username ELSE contributors.discord_username END,
         first_name        = EXCLUDED.first_name,
         last_name         = EXCLUDED.last_name,
         email             = EXCLUDED.email,
         company           = EXCLUDED.company,
         updated_at        = now()
       RETURNING *`,
      [
        input.githubId,
        input.githubLogin,
        input.telegramId ?? null,
        input.telegramUsername ?? null,
        input.telegramPhone ?? null,
        input.discordId ?? null,
        input.discordUsername ?? null,
        input.firstName,
        input.lastName,
        input.email,
        input.company ?? null,
      ],
    )
    return toContributor(rows[0])
  } catch (error) {
    const constraint = (error as { code?: string; constraint?: string })
    if (constraint.code === '23505') {
      if (constraint.constraint?.includes('telegram_id')) throw new AccountAlreadyLinkedError('telegram')
      if (constraint.constraint?.includes('discord_id')) throw new AccountAlreadyLinkedError('discord')
    }
    throw error
  }
}
