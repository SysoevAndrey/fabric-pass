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
