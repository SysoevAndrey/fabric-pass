import { afterAll, beforeEach, expect, test } from 'vitest'
import {
  type AdminFieldsUpdate,
  ContributorNotFoundError,
  ensureContributor,
  findByGithubId,
  linkProvider,
  listContributorsForRegistry,
  resolveProviderLabels,
  saveField,
  syncContributorAdminFields,
} from './contributors.ts'
import { pool } from './db.ts'

/** `status` is the only field every caller of syncContributorAdminFields
 * actually varies test to test; the other two default the same way an
 * absent registry-file value does (see contributors-registry.ts). */
function adminUpdate(overrides: Partial<AdminFieldsUpdate> & { githubId: string }): AdminFieldsUpdate {
  return { status: 'confirmed', aliasOfGithubId: null, isAgent: false, ...overrides }
}

beforeEach(async () => {
  await pool.query('TRUNCATE contributors')
})

afterAll(async () => {
  await pool.end()
})

test('signing in with GitHub creates a row with no other field filled in yet', async () => {
  await ensureContributor('1001', 'octocat')

  const found = await findByGithubId('1001')
  expect(found?.githubLogin).toBe('octocat')
  expect(found?.name).toBeUndefined()
  expect(found?.email).toBeUndefined()
  expect(found?.telegramUsername).toBeUndefined()
  // Only an admin editing the cf-internal registry can promote this — see
  // migrations/005_contributor_status.sql.
  expect(found?.status).toBe('draft')
})

test('returns null for an unknown github id', async () => {
  expect(await findByGithubId('999')).toBeNull()
})

test('a returning contributor updates the same row rather than adding one', async () => {
  await ensureContributor('1001', 'octocat')
  await ensureContributor('1001', 'octocat-renamed')

  const { rows } = await pool.query('SELECT count(*)::int AS n FROM contributors')
  expect(rows[0].n).toBe(1)
  expect((await findByGithubId('1001'))?.githubLogin).toBe('octocat-renamed')
})

test('stores the github name and public email, and keeps them fresh on a returning sign-in', async () => {
  await ensureContributor('1001', 'octocat', 'The Octocat', 'octocat@github.com')

  let found = await findByGithubId('1001')
  expect(found?.githubName).toBe('The Octocat')
  expect(found?.githubEmail).toBe('octocat@github.com')

  await ensureContributor('1001', 'octocat', 'Octo Cat', undefined)

  found = await findByGithubId('1001')
  expect(found?.githubName).toBe('Octo Cat')
  // A since-removed public email must not survive as a stale value.
  expect(found?.githubEmail).toBeUndefined()
})

test('prefills the typed name/email from github only while the field is still empty', async () => {
  await ensureContributor('1001', 'octocat', 'The Octocat', 'octocat@github.com')

  let found = await findByGithubId('1001')
  expect(found?.name).toBe('The Octocat')
  expect(found?.email).toBe('octocat@github.com')

  await saveField('1001', 'name', 'Ada Lovelace')
  await saveField('1001', 'email', undefined) // clearing is deliberate — see saveField's own doc comment

  // A later sign-in with a changed github name/email must not clobber the
  // name the contributor has since typed, prefilled or not — but the email,
  // deliberately cleared back to empty, is fair game again.
  await ensureContributor('1001', 'octocat', 'Something Else', 'something-else@github.com')

  found = await findByGithubId('1001')
  expect(found?.name).toBe('Ada Lovelace')
  expect(found?.email).toBe('something-else@github.com')
})

test('linking a provider does not disturb the other provider or the typed fields', async () => {
  await ensureContributor('1001', 'octocat')
  await saveField('1001', 'name', 'Ada Lovelace')
  await linkProvider('1001', 'discord', { providerId: '555', username: 'ada-discord', name: 'Ada' })

  await linkProvider('1001', 'telegram', { providerId: '777', username: 'ada-tg', name: 'Ada Lovelace TG' })

  const found = await findByGithubId('1001')
  expect(found?.name).toBe('Ada Lovelace')
  expect(found?.discordId).toBe('555')
  expect(found?.discordUsername).toBe('ada-discord')
  expect(found?.discordName).toBe('Ada')
  expect(found?.telegramId).toBe('777')
  expect(found?.telegramUsername).toBe('ada-tg')
  expect(found?.telegramName).toBe('Ada Lovelace TG')
})

// A provider's fields move together as a unit, the same invariant the old
// upsert-with-COALESCE design had to work for: Telegram's username and phone
// are mutually exclusive by construction (toIdentity returns one or the
// other, never both — see providers/telegram.ts), so a stale phone number
// must not survive next to a newly linked, username-bearing account.
test('re-linking telegram to a username-bearing account clears a previously stored phone', async () => {
  await ensureContributor('1001', 'octocat')
  await linkProvider('1001', 'telegram', { providerId: '111', phone: '+359888123456' })

  await linkProvider('1001', 'telegram', { providerId: '222', username: 'ada-tg' })

  const found = await findByGithubId('1001')
  expect(found?.telegramId).toBe('222')
  expect(found?.telegramUsername).toBe('ada-tg')
  expect(found?.telegramPhone).toBeUndefined()
})

// The exact defect this exists to catch: Telegram's OIDC `sub` is a string,
// not bounded by 64 bits, and production saw a real id 20 digits long — past
// bigint's ~9.2e18 max — rejected as "out of range for type bigint" on a
// callback that had already succeeded with Telegram (migrations/003 is the
// fix; this exercises the app path on top of it).
test('a telegram id larger than bigint can hold still links and reads back exactly', async () => {
  await ensureContributor('1001', 'octocat')
  const oversizedId = '12183332595470058690'

  await linkProvider('1001', 'telegram', { providerId: oversizedId, username: 'ada-tg' })

  const found = await findByGithubId('1001')
  expect(found?.telegramId).toBe(oversizedId)
})

// Completing a provider's OAuth flow is the strongest proof this app ever
// gets that two rows are the same real person, so a telegram_id/discord_id
// unique-constraint hit is not refused — see linkProvider's own doc comment.
test('linking a telegram account already linked elsewhere succeeds and records the newer row as an alias', async () => {
  await ensureContributor('1001', 'octocat')
  await linkProvider('1001', 'telegram', { providerId: '555', username: 'ada' })
  await ensureContributor('1002', 'grace')

  await expect(linkProvider('1002', 'telegram', { providerId: '555', username: 'ada' })).resolves.toBeUndefined()

  const newer = await findByGithubId('1002')
  expect(newer?.aliasOfGithubId).toBe('1001')
  // The identity itself is never duplicated — it stays only on the row that
  // already held it, keeping the unique constraint intact in storage.
  expect(newer?.telegramId).toBeUndefined()
  expect((await findByGithubId('1001'))?.telegramId).toBe('555')
})

test('linking a discord account already linked elsewhere succeeds and records the newer row as an alias', async () => {
  await ensureContributor('1001', 'octocat')
  await linkProvider('1001', 'discord', { providerId: '888', username: 'ada' })
  await ensureContributor('1002', 'grace')

  await expect(linkProvider('1002', 'discord', { providerId: '888', username: 'ada' })).resolves.toBeUndefined()

  expect((await findByGithubId('1002'))?.aliasOfGithubId).toBe('1001')
})

test('a shared-identity alias never overwrites an alias already set to someone else', async () => {
  await ensureContributor('1001', 'octocat')
  await linkProvider('1001', 'discord', { providerId: '888', username: 'ada' })
  await ensureContributor('1002', 'grace')
  await ensureContributor('1003', 'ada-third')
  // 1002 is already declared (e.g. by an admin) as an alias of 1003, not 1001.
  await syncContributorAdminFields([adminUpdate({ githubId: '1002', status: 'draft', aliasOfGithubId: '1003' })])

  // Still succeeds — the OAuth login itself is never refused — but the
  // existing, conflicting alias claim is left for an admin to sort out
  // rather than silently overwritten.
  await expect(linkProvider('1002', 'discord', { providerId: '888', username: 'ada' })).resolves.toBeUndefined()

  expect((await findByGithubId('1002'))?.aliasOfGithubId).toBe('1003')
})

test('linkProvider fails loud when the github id names no row', async () => {
  await expect(linkProvider('999999', 'discord', { providerId: '1', username: 'x' })).rejects.toThrow(
    /no contributor row/,
  )
  // Distinct from a transient error: callers use this to tell a contributor
  // to sign in again rather than to retry a save that can never succeed.
  await expect(linkProvider('999999', 'discord', { providerId: '1', username: 'x' })).rejects.toBeInstanceOf(
    ContributorNotFoundError,
  )
})

test('saveField persists each typed field independently, including clearing it back to empty', async () => {
  await ensureContributor('1001', 'octocat')

  await saveField('1001', 'name', 'Ada Lovelace')
  await saveField('1001', 'email', 'ada@example.com')
  await saveField('1001', 'company', 'Analytical Engines')
  expect(await findByGithubId('1001')).toMatchObject({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    company: 'Analytical Engines',
  })

  await saveField('1001', 'company', undefined)
  const afterClear = await findByGithubId('1001')
  expect(afterClear?.company).toBeUndefined()
  // A save that names one column must not disturb the others.
  expect(afterClear?.name).toBe('Ada Lovelace')
  expect(afterClear?.email).toBe('ada@example.com')
})

test('saveField fails loud when the github id names no row', async () => {
  await expect(saveField('999999', 'name', 'Ada')).rejects.toThrow(/no contributor row/)
  await expect(saveField('999999', 'name', 'Ada')).rejects.toBeInstanceOf(ContributorNotFoundError)
})

// `field` is typed `DetailField` here, but that's compile-time only — this
// is the query-building layer itself, so an unrecognized value is checked
// explicitly rather than trusted to become a harmless column name.
test('saveField rejects a field name outside the closed set rather than building a query around it', async () => {
  await ensureContributor('1001', 'octocat')

  // @ts-expect-error — exercising the runtime guard for a value the type
  // system would otherwise rule out.
  await expect(saveField('1001', 'is_admin', 'true')).rejects.toThrow(/not a recognized field/)
})

test('syncContributorAdminFields applies status/alias/is_agent and reports an unmatched github_id back', async () => {
  await ensureContributor('1001', 'octocat')
  await ensureContributor('2002', 'grace')

  const { updated, notFound, rejected } = await syncContributorAdminFields([
    adminUpdate({ githubId: '1001', status: 'confirmed', isAgent: true }),
    adminUpdate({ githubId: '999999' }),
  ])

  expect(updated).toEqual(['1001'])
  expect(notFound).toEqual(['999999'])
  expect(rejected).toEqual([])
  const found = await findByGithubId('1001')
  expect(found?.status).toBe('confirmed')
  expect(found?.isAgent).toBe(true)
  // Untouched by the sync — still its defaults.
  const other = await findByGithubId('2002')
  expect(other?.status).toBe('draft')
  expect(other?.isAgent).toBe(false)
})

test('syncContributorAdminFields sets an alias pointing at another real contributor', async () => {
  await ensureContributor('1001', 'octocat')
  await ensureContributor('2002', 'grace')

  const { updated } = await syncContributorAdminFields([adminUpdate({ githubId: '2002', aliasOfGithubId: '1001' })])

  expect(updated).toEqual(['2002'])
  expect((await findByGithubId('2002'))?.aliasOfGithubId).toBe('1001')
})

test('syncContributorAdminFields rejects an alias pointing at a github_id this app has never seen', async () => {
  await ensureContributor('1001', 'octocat')

  const { updated, rejected } = await syncContributorAdminFields([
    adminUpdate({ githubId: '1001', aliasOfGithubId: '999999' }),
  ])

  expect(updated).toEqual([])
  expect(rejected).toEqual(['1001'])
  // Rejected, so nothing about the row changed at all.
  expect((await findByGithubId('1001'))?.aliasOfGithubId).toBeUndefined()
})

test('syncContributorAdminFields rejects a contributor aliased to themselves', async () => {
  await ensureContributor('1001', 'octocat')

  const { rejected } = await syncContributorAdminFields([adminUpdate({ githubId: '1001', aliasOfGithubId: '1001' })])

  expect(rejected).toEqual(['1001'])
})

test('listContributorsForRegistry returns every contributor, ordered by github login', async () => {
  await ensureContributor('2002', 'grace')
  await ensureContributor('1001', 'ada')

  const registry = await listContributorsForRegistry()

  expect(registry.map((c) => c.githubLogin)).toEqual(['ada', 'grace'])
})

test('resolveProviderLabels shows a contributor their own direct link when they have one', async () => {
  await ensureContributor('1001', 'octocat')
  await linkProvider('1001', 'telegram', { providerId: '555', username: 'ada' })

  const labels = await resolveProviderLabels((await findByGithubId('1001'))!)

  expect(labels.telegramLabel).toBe('@ada')
  expect(labels.discordLabel).toBeNull()
})

test('resolveProviderLabels inherits an alias target\'s link when the row has none of its own', async () => {
  await ensureContributor('1001', 'octocat')
  await linkProvider('1001', 'telegram', { providerId: '555', username: 'ada' })
  await ensureContributor('1002', 'grace')
  await linkProvider('1002', 'telegram', { providerId: '555', username: 'ada' }) // sets 1002's alias to 1001

  const labels = await resolveProviderLabels((await findByGithubId('1002'))!)

  expect(labels.telegramLabel).toBe('@ada')
})

test('resolveProviderLabels never inherits when the row already has its own link', async () => {
  await ensureContributor('1001', 'octocat')
  await linkProvider('1001', 'discord', { providerId: '888', username: 'ada' })
  await ensureContributor('1002', 'grace')
  await linkProvider('1002', 'discord', { providerId: '999', username: 'grace-discord' })

  const labels = await resolveProviderLabels((await findByGithubId('1002'))!)

  expect(labels.discordLabel).toBe('grace-discord')
})
