import { afterAll, beforeEach, expect, test } from 'vitest'
import {
  AccountAlreadyLinkedError,
  ContributorNotFoundError,
  ensureContributor,
  findByGithubId,
  linkProvider,
  saveField,
} from './contributors.ts'
import { pool } from './db.ts'

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

test('linking a provider does not disturb the other provider or the typed fields', async () => {
  await ensureContributor('1001', 'octocat')
  await saveField('1001', 'name', 'Ada Lovelace')
  await linkProvider('1001', 'discord', { providerId: '555', username: 'ada-discord' })

  await linkProvider('1001', 'telegram', { providerId: '777', username: 'ada-tg' })

  const found = await findByGithubId('1001')
  expect(found?.name).toBe('Ada Lovelace')
  expect(found?.discordId).toBe('555')
  expect(found?.discordUsername).toBe('ada-discord')
  expect(found?.telegramId).toBe('777')
  expect(found?.telegramUsername).toBe('ada-tg')
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

test('refuses a telegram account already linked to someone else', async () => {
  await ensureContributor('1001', 'octocat')
  await linkProvider('1001', 'telegram', { providerId: '555', username: 'ada' })
  await ensureContributor('1002', 'grace')

  await expect(linkProvider('1002', 'telegram', { providerId: '555', username: 'ada' })).rejects.toBeInstanceOf(
    AccountAlreadyLinkedError,
  )
})

test('refuses a discord account already linked to someone else', async () => {
  await ensureContributor('1001', 'octocat')
  await linkProvider('1001', 'discord', { providerId: '888', username: 'ada' })
  await ensureContributor('1002', 'grace')

  await expect(linkProvider('1002', 'discord', { providerId: '888', username: 'ada' })).rejects.toBeInstanceOf(
    AccountAlreadyLinkedError,
  )
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
