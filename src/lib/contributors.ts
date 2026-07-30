import { pool } from '@/lib/db'
import type { Identity, ProviderName } from '@/lib/providers/types'

export interface Contributor {
  id: string
  githubId: string
  githubLogin: string
  githubName?: string
  githubEmail?: string
  telegramId?: string
  telegramUsername?: string
  telegramPhone?: string
  telegramName?: string
  discordId?: string
  discordUsername?: string
  discordName?: string
  name?: string
  email?: string
  company?: string
  createdAt: Date
  updatedAt: Date
}

/** The three fields a contributor types, saved one at a time as they autosave. */
export const DETAIL_FIELDS = ['name', 'email', 'company'] as const
export type DetailField = (typeof DETAIL_FIELDS)[number]

/**
 * The real boundary check for `DetailField`: `saveField` (here and the
 * `'use server'` action wrapping it in app/actions.ts) is reachable as a
 * plain HTTP endpoint, where `DetailField` is erased to `string` before this
 * function ever sees it. Compile-time typing alone would let an arbitrary
 * field name through to the query below.
 */
export function isDetailField(value: string): value is DetailField {
  return (DETAIL_FIELDS as readonly string[]).includes(value)
}

export class AccountAlreadyLinkedError extends Error {
  constructor(readonly provider: 'telegram' | 'discord') {
    super(`This ${provider} account is already linked to another contributor.`)
    this.name = 'AccountAlreadyLinkedError'
  }
}

/**
 * Thrown when a github id names no contributor row — distinct from a
 * transient database error so callers can tell the two apart: a stale
 * session cookie outliving its row can never be fixed by retrying, only by
 * signing in again, while a connection blip is worth retrying as-is.
 */
export class ContributorNotFoundError extends Error {
  constructor(readonly githubId: string) {
    super(`no contributor row for github id ${githubId}`)
    this.name = 'ContributorNotFoundError'
  }
}

interface Row {
  id: string
  github_id: string
  github_login: string
  github_name: string | null
  github_email: string | null
  telegram_id: string | null
  telegram_username: string | null
  telegram_phone: string | null
  telegram_name: string | null
  discord_id: string | null
  discord_username: string | null
  discord_name: string | null
  name: string | null
  email: string | null
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
    githubName: row.github_name ?? undefined,
    githubEmail: row.github_email ?? undefined,
    telegramId: row.telegram_id ?? undefined,
    telegramUsername: row.telegram_username ?? undefined,
    telegramPhone: row.telegram_phone ?? undefined,
    telegramName: row.telegram_name ?? undefined,
    discordId: row.discord_id ?? undefined,
    discordUsername: row.discord_username ?? undefined,
    discordName: row.discord_name ?? undefined,
    name: row.name ?? undefined,
    email: row.email ?? undefined,
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
 * Creates the row the instant a contributor signs in with GitHub — the point
 * where autosave begins — or, for a returning contributor, refreshes the one
 * GitHub fact that can change under a stable account id. Every other write in
 * this module (linkProvider, saveField) targets a row this function has
 * already created: the page only offers a link button or a typed field once
 * signed in, so by the time either fires this insert has already happened.
 *
 * `name`/`email` — the contributor's own typed fields — get GitHub's values
 * as a starting point exactly once, on the insert that creates the row (or
 * whenever the typed field is still empty on a later sign-in); a value the
 * contributor has since typed is never overwritten by a freshly-changed
 * GitHub name or email.
 */
export async function ensureContributor(
  githubId: string,
  githubLogin: string,
  githubName?: string,
  githubEmail?: string,
): Promise<Contributor> {
  const { rows } = await pool.query<Row>(
    `INSERT INTO contributors (github_id, github_login, github_name, github_email, name, email)
          VALUES ($1, $2, $3, $4, $3, $4)
     ON CONFLICT (github_id) DO UPDATE
       SET github_login = EXCLUDED.github_login,
           github_name = EXCLUDED.github_name,
           github_email = EXCLUDED.github_email,
           name = COALESCE(contributors.name, EXCLUDED.name),
           email = COALESCE(contributors.email, EXCLUDED.email),
           updated_at = now()
       RETURNING *`,
    [githubId, githubLogin, githubName ?? null, githubEmail ?? null],
  )
  return toContributor(rows[0])
}

/**
 * Writes one provider's whole identity as a unit — id together with username
 * and phone — the moment its OAuth callback returns, so a value left over
 * from a *different* linked account cannot survive beside the new one.
 * Telegram's username and phone are mutually exclusive by construction (see
 * providers/telegram.ts's toIdentity), so re-linking a username-bearing
 * account after a phone-only one has to clear the phone rather than keep it:
 * the project has no basis to hold a number that no longer belongs to the
 * linked account.
 *
 * Throws if `githubId` names no row — every caller reaches this only after
 * `ensureContributor`, so a miss here means that invariant broke rather than
 * something worth silently ignoring.
 */
export async function linkProvider(
  githubId: string,
  provider: Exclude<ProviderName, 'github'>,
  identity: Identity,
): Promise<void> {
  const sql =
    provider === 'telegram'
      ? `UPDATE contributors
            SET telegram_id = $2, telegram_username = $3, telegram_phone = $4, telegram_name = $5, updated_at = now()
          WHERE github_id = $1`
      : `UPDATE contributors
            SET discord_id = $2, discord_username = $3, discord_name = $4, updated_at = now()
          WHERE github_id = $1`

  const params =
    provider === 'telegram'
      ? [githubId, identity.providerId, identity.username ?? null, identity.phone ?? null, identity.name ?? null]
      : [githubId, identity.providerId, identity.username ?? null, identity.name ?? null]

  let result
  try {
    result = await pool.query(sql, params)
  } catch (error) {
    const violation = error as { code?: string; constraint?: string }
    if (violation.code === '23505') throw new AccountAlreadyLinkedError(provider)
    throw error
  }
  if (result.rowCount === 0) throw new ContributorNotFoundError(githubId)
}

/**
 * Saves one typed field exactly as given, including empty (stored as null) —
 * clearing a field is as deliberate an edit as filling one, and with no Save
 * button this is the only path a keystroke has to the database. Each field
 * autosaves independently so that, say, a still-invalid email in progress
 * never blocks a finished name from persisting.
 */
export async function saveField(githubId: string, field: DetailField, value: string | undefined): Promise<void> {
  // `field` is typed `DetailField` for every in-repo caller, but this is the
  // one place the column name reaches a query string, so the closed set is
  // re-checked here too rather than trusting the type alone (see
  // isDetailField's doc comment).
  if (!isDetailField(field)) throw new Error(`saveField: not a recognized field: ${field}`)
  const column = { name: 'name', email: 'email', company: 'company' }[field]
  const result = await pool.query(`UPDATE contributors SET ${column} = $2, updated_at = now() WHERE github_id = $1`, [
    githubId,
    value ?? null,
  ])
  if (result.rowCount === 0) throw new ContributorNotFoundError(githubId)
}
