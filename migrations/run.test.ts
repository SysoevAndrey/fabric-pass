import { afterAll, beforeEach, expect, test } from 'vitest'
import pg from 'pg'
import { migrate } from './run.ts'

// tests/setup.ts has pointed DATABASE_URL at the test database.
const url = process.env.DATABASE_URL!
const pool = new pg.Pool({ connectionString: url })

beforeEach(async () => {
  await pool.query('DROP TABLE IF EXISTS contributors, schema_migrations')
})

afterAll(async () => {
  await pool.end()
})

test('applies pending migrations and records them', async () => {
  const applied = await migrate(url)
  expect(applied).toContain('001_contributors.sql')

  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'contributors' ORDER BY column_name`,
  )
  const columns = rows.map((r) => r.column_name)
  expect(columns).toContain('github_id')
  expect(columns).toContain('telegram_phone')
  expect(columns).toContain('discord_username')
})

test('is idempotent — a second run applies nothing', async () => {
  await migrate(url)
  const second = await migrate(url)
  expect(second).toEqual([])
})
