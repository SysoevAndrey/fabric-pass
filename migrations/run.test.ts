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

  // 003 (telegram_id -> text), 004 (provider profile fields), and 005
  // (contributor status) are also pending from this pre-002 starting point
  // and apply right behind 002 — irrelevant to what this test checks, but
  // `migrate` returns every file it applied.
  const applied = await migrate(url)
  expect(applied).toEqual([
    '002_contributor_name_and_nullable_fields.sql',
    '003_telegram_id_as_text.sql',
    '004_provider_profile_fields.sql',
    '005_contributor_status.sql',
  ])

  const { rows } = await pool.query('SELECT github_login, name FROM contributors ORDER BY github_login')
  const nameByLogin = Object.fromEntries(rows.map((r) => [r.github_login, r.name]))
  expect(nameByLogin['both-names']).toBe('Ada Lovelace')
  expect(nameByLogin['first-only']).toBe('Grace')
  expect(nameByLogin['last-only']).toBe('Hopper')
  expect(nameByLogin['both-blank']).toBeNull()
})

// 003 is the fix for a real production failure: a Telegram id of
// "12183332595470058690" (20 digits) was rejected as "out of range for type
// bigint" on a callback that had already succeeded with Telegram. This
// applies 001 and 002 by hand to get a pre-003 table with telegram_id still
// bigint, seeds a value the way that schema required, then lets `migrate`
// apply 003 on top and checks both that the existing value carried across and
// that the column can now hold an id past bigint's range.
test('the telegram_id migration carries an existing value across to text and accepts an id past bigint range', async () => {
  const sql001 = await readFile(join(here, '001_contributors.sql'), 'utf8')
  const sql002 = await readFile(join(here, '002_contributor_name_and_nullable_fields.sql'), 'utf8')
  await pool.query(sql001)
  await pool.query(sql002)
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename   text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  )
  await pool.query(
    `INSERT INTO schema_migrations (filename) VALUES
       ('001_contributors.sql'), ('002_contributor_name_and_nullable_fields.sql')`,
  )
  await pool.query(`INSERT INTO contributors (github_id, github_login, telegram_id) VALUES (1, 'has-telegram', 555)`)

  // 004 (provider profile fields) and 005 (contributor status) are also
  // pending from this pre-003 starting point and apply right behind 003.
  const applied = await migrate(url)
  expect(applied).toEqual([
    '003_telegram_id_as_text.sql',
    '004_provider_profile_fields.sql',
    '005_contributor_status.sql',
  ])

  const { rows: columnRows } = await pool.query(
    `SELECT data_type FROM information_schema.columns WHERE table_name = 'contributors' AND column_name = 'telegram_id'`,
  )
  expect(columnRows[0].data_type).toBe('text')

  const { rows: carriedRows } = await pool.query(
    `SELECT telegram_id FROM contributors WHERE github_login = 'has-telegram'`,
  )
  expect(carriedRows[0].telegram_id).toBe('555')

  const oversized = '12183332595470058690' // past bigint's ~9.2e18 max — the exact shape of id that overflowed in production
  await pool.query(`UPDATE contributors SET telegram_id = $1 WHERE github_login = 'has-telegram'`, [oversized])
  const { rows: oversizedRows } = await pool.query(
    `SELECT telegram_id FROM contributors WHERE github_login = 'has-telegram'`,
  )
  expect(oversizedRows[0].telegram_id).toBe(oversized)
})
