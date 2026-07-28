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
