import { afterAll, beforeEach, expect, test } from 'vitest'
import { AccountAlreadyLinkedError, findByGithubId, upsert } from './contributors.ts'
import { pool } from './db.ts'

const base = {
  githubId: '1001',
  githubLogin: 'octocat',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
}

beforeEach(async () => {
  await pool.query('TRUNCATE contributors')
})

afterAll(async () => {
  await pool.end()
})

test('creates a contributor and reads it back', async () => {
  await upsert(base)
  const found = await findByGithubId('1001')
  expect(found?.githubLogin).toBe('octocat')
  expect(found?.email).toBe('ada@example.com')
  expect(found?.telegramUsername).toBeUndefined()
})

test('returns null for an unknown github id', async () => {
  expect(await findByGithubId('999')).toBeNull()
})

test('a second save updates the same row rather than adding one', async () => {
  await upsert(base)
  await upsert({ ...base, company: 'Analytical Engines', discordId: '77', discordUsername: 'ada' })

  const { rows } = await pool.query('SELECT count(*)::int AS n FROM contributors')
  expect(rows[0].n).toBe(1)

  const found = await findByGithubId('1001')
  expect(found?.company).toBe('Analytical Engines')
  expect(found?.discordUsername).toBe('ada')
})

test('a renamed github account keeps the same row', async () => {
  await upsert(base)
  await upsert({ ...base, githubLogin: 'ada-l' })

  const { rows } = await pool.query('SELECT count(*)::int AS n FROM contributors')
  expect(rows[0].n).toBe(1)
  expect((await findByGithubId('1001'))?.githubLogin).toBe('ada-l')
})

test('refuses a telegram account already linked to someone else', async () => {
  await upsert({ ...base, telegramId: '555', telegramUsername: 'ada' })

  await expect(
    upsert({ ...base, githubId: '1002', githubLogin: 'grace', telegramId: '555', telegramUsername: 'ada' }),
  ).rejects.toBeInstanceOf(AccountAlreadyLinkedError)
})

test('refuses a discord account already linked to someone else', async () => {
  await upsert({ ...base, discordId: '888', discordUsername: 'ada' })

  await expect(
    upsert({ ...base, githubId: '1002', githubLogin: 'grace', discordId: '888', discordUsername: 'ada' }),
  ).rejects.toBeInstanceOf(AccountAlreadyLinkedError)
})

// Link columns (telegram_id/username/phone, discord_id/username) are
// preserved by COALESCE when a later save omits them — the save action no
// longer reads the row first, so "omitted" and "never linked" look the same
// on the wire, and the upsert itself must carry existing links forward.
// first_name/last_name/email/company are not link columns: they still
// overwrite unconditionally, so omitting company clears it to NULL.
test('a later save that omits link fields preserves them, but omitting company clears it', async () => {
  await upsert({
    ...base,
    telegramId: '555',
    telegramUsername: 'ada',
    telegramPhone: '+359888123456',
    discordId: '777',
    discordUsername: 'ada-discord',
    company: 'Analytical Engines',
  })

  // Same github id, second save carries no link fields and no company.
  await upsert(base)

  const found = await findByGithubId('1001')
  expect(found?.telegramId).toBe('555')
  expect(found?.telegramUsername).toBe('ada')
  expect(found?.telegramPhone).toBe('+359888123456')
  expect(found?.discordId).toBe('777')
  expect(found?.discordUsername).toBe('ada-discord')
  expect(found?.company).toBeUndefined()

  const { rows } = await pool.query(
    'SELECT telegram_id, company FROM contributors WHERE github_id = $1',
    ['1001'],
  )
  expect(rows[0].telegram_id).toBe('555')
  expect(rows[0].company).toBeNull()
})

// A provider's fields move together, keyed off whether a *new id* for that
// provider was supplied. Telegram's username and phone are mutually
// exclusive by construction (toIdentity returns one or the other, never
// both — see telegram.ts), so a naive per-column COALESCE lets a field from
// the *old* linked account survive next to a field from a *new* one: link
// with a phone, then re-link a different telegram_id that has a username,
// and the stale phone number would stick around forever. That is a stored
// fact about someone the project no longer has any basis to hold — a
// privacy defect, not just a data-tidiness one.

test('re-linking telegram with a new id clears a stale phone left from the old id', async () => {
  await upsert({ ...base, telegramId: '500', telegramPhone: '+359888000111' })
  await upsert({ ...base, telegramId: '600', telegramUsername: 'ada_new' })

  const row = await findByGithubId('1001')
  expect(row?.telegramId).toBe('600')
  expect(row?.telegramUsername).toBe('ada_new')
  expect(row?.telegramPhone).toBeUndefined()

  const { rows } = await pool.query('SELECT telegram_phone FROM contributors WHERE github_id = $1', ['1001'])
  expect(rows[0].telegram_phone).toBeNull()
})

test('re-linking telegram with a new id clears a stale username left from the old id', async () => {
  await upsert({ ...base, telegramId: '700', telegramUsername: 'ada_old' })
  await upsert({ ...base, telegramId: '800', telegramPhone: '+359888222333' })

  const row = await findByGithubId('1001')
  expect(row?.telegramId).toBe('800')
  expect(row?.telegramPhone).toBe('+359888222333')
  expect(row?.telegramUsername).toBeUndefined()

  const { rows } = await pool.query('SELECT telegram_username FROM contributors WHERE github_id = $1', ['1001'])
  expect(rows[0].telegram_username).toBeNull()
})

test('re-linking discord with a new id clears a stale username left from the old id', async () => {
  await upsert({ ...base, discordId: '900', discordUsername: 'ada-discord-old' })
  // A re-link that supplies a new discord_id but no username this time —
  // the stale username must not survive next to the new id.
  await upsert({ ...base, discordId: '901' })

  const row = await findByGithubId('1001')
  expect(row?.discordId).toBe('901')
  expect(row?.discordUsername).toBeUndefined()

  const { rows } = await pool.query('SELECT discord_username FROM contributors WHERE github_id = $1', ['1001'])
  expect(rows[0].discord_username).toBeNull()
})
