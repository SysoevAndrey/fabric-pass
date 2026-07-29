import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeEach, expect, test } from 'vitest'
import pg from 'pg'
import { migrate } from './run.ts'

const here = dirname(fileURLToPath(import.meta.url))

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

// 002's backfill (`NULLIF(trim(concat_ws(' ', first_name, last_name)), '')`)
// is the piece that carried the one production row across when first_name
// and last_name were dropped in favor of one `name` column — nothing else
// here exercises it, since the other tests start from an empty table. This
// applies 001 by hand to get the table into its pre-002 shape, seeds rows the
// way that schema required (first_name/last_name NOT NULL), then lets
// `migrate` apply 002 on top and checks what the backfill actually did.
test('the name backfill combines first and last name, and leaves both-blank as NULL rather than an empty string', async () => {
  const sql001 = await readFile(join(here, '001_contributors.sql'), 'utf8')
  await pool.query(sql001)
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename   text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  )
  await pool.query(`INSERT INTO schema_migrations (filename) VALUES ('001_contributors.sql')`)

  await pool.query(
    `INSERT INTO contributors (github_id, github_login, first_name, last_name, email) VALUES
       (1, 'both-names', 'Ada', 'Lovelace', 'ada@example.com'),
       (2, 'first-only', 'Grace', '', 'grace@example.com'),
       (3, 'last-only', '', 'Hopper', 'hopper@example.com'),
       (4, 'both-blank', '', '', 'blank@example.com')`,
  )

  const applied = await migrate(url)
  expect(applied).toEqual(['002_contributor_name_and_nullable_fields.sql'])

  const { rows } = await pool.query('SELECT github_login, name FROM contributors ORDER BY github_login')
  const nameByLogin = Object.fromEntries(rows.map((r) => [r.github_login, r.name]))
  expect(nameByLogin['both-names']).toBe('Ada Lovelace')
  expect(nameByLogin['first-only']).toBe('Grace')
  expect(nameByLogin['last-only']).toBe('Hopper')
  expect(nameByLogin['both-blank']).toBeNull()
})
