# Contributor Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A web form where an open-source contributor signs in with GitHub, optionally links Telegram and Discord, and records their name, email, and company as one row in Postgres.

**Architecture:** A single Next.js App Router application backed by Postgres. All three providers use the OAuth 2.0 authorization code flow with PKCE through one library, `openid-client`, behind a uniform per-provider module interface. Session state — the signed-in GitHub identity, pending provider links, and the in-flight OAuth transaction — lives in an encrypted cookie, so nothing reaches the database until the contributor submits the form.

**Tech Stack:** TypeScript, Next.js 16.2.12, React 19.2.8, `openid-client` 6.8.4, `iron-session` 8.0.4, `pg` 8.22.0, `zod` 4.4.3, Vitest 4.1.10, PostgreSQL 18.

**Design spec:** [2026-07-28-contributor-registry-design.md](../specs/2026-07-28-contributor-registry-design.md)

## Global Constraints

- **TypeScript only. Never author a `.js` file** — including config and scripts. Node 24.16.0 strips types natively, so `node script.ts` runs without a loader or a build step. Verified on this machine. Because Node needs the literal `.ts` extension in relative imports, `tsconfig.json` carries `allowImportingTsExtensions: true` — without it `tsc --noEmit` rejects the test files' `./module.ts` imports.
- Package manager: **pnpm 11.17.0**. Node **24.16.0**.
- **Only identity is persisted from providers.** No access tokens, no refresh tokens, no `id_token`, no avatars, no provider-supplied email addresses or names. A task that stores any of these is wrong.
- Store **both** the provider's numeric ID and the username for every provider. Usernames are user-changeable; numeric IDs are not.
- `pg` returns `bigint` (`int8`) columns as **strings** to avoid precision loss. Every provider ID is typed `string` in TypeScript throughout.
- In Next.js 16, `cookies()` from `next/headers` is **async** — always `await cookies()`.
- GitHub PKCE requires `code_challenge_method: 'S256'`; `plain` is not supported.
- GitHub's token endpoint returns form-encoded data unless the request carries `Accept: application/json`.
- GitHub is called with **no scope** — an empty scope already grants read access to the public profile, which includes `login`.

## Prerequisites

PostgreSQL is not installed on this machine, and there is no container runtime. Task 2 installs PostgreSQL 18 via Homebrew and uses it for both development and tests. This matches production, which avoids a second database engine diverging from the real one.

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts` | Toolchain |
| `.env.test`, `tests/setup.ts` | Fake credentials so the suite runs on a fresh checkout |
| `migrations/001_contributors.sql` | The one table |
| `migrations/run.ts` | Applies pending migrations, tracks them in `schema_migrations` |
| `src/lib/env.ts` | Zod-validated environment; fails fast at startup |
| `src/lib/db.ts` | `pg` connection pool singleton |
| `src/lib/contributors.ts` | The only module containing SQL: one read, one upsert |
| `src/lib/session.ts` | `iron-session` types and accessor |
| `src/lib/providers/types.ts` | The `Provider` contract shared by all three |
| `src/lib/providers/github.ts` | GitHub: manual OAuth 2.0 config, `/user` |
| `src/lib/providers/discord.ts` | Discord: manual OAuth 2.0 config, `/users/@me` |
| `src/lib/providers/telegram.ts` | Telegram: OIDC discovery, username-or-phone resolution |
| `src/lib/providers/index.ts` | Name → provider lookup |
| `src/app/auth/[provider]/route.ts` | Starts an authorization request |
| `src/app/auth/[provider]/callback/route.ts` | Handles the redirect back |
| `src/app/page.tsx` | The single page (server component): signed out, form, submitted |
| `src/app/form.tsx` | The client boundary — the form itself |
| `src/app/form-schema.ts` | Form validation, kept out of the `'use server'` module |
| `src/app/actions.ts` | Server action that saves the contributor |
| `Dockerfile`, `README.md`, `.env.example` | Deployment |

### Test strategy

Provider modules are split so that the part worth testing is pure. Each provider exposes a `toIdentity()` function that maps a provider's profile payload onto our `Identity` shape — that is where the real logic lives (which field holds the username, when a phone substitutes for it). These are unit-tested directly.

The OAuth transport itself is `openid-client`'s job. Validating Telegram's `id_token` signature against its JWKS is that library's responsibility, and re-testing it here would be testing someone else's crypto. One integration test (Task 5) drives a full round trip through GitHub — the simplest of the three, no JWT to forge — with `fetch` stubbed to return canned token and profile responses. It also asserts the negative: a profile carrying an email and an avatar yields an identity holding neither.

The happy path across all three providers is a **manual gate in Task 10**, walked against the real provider applications. This deviates deliberately from the spec's "one happy path with stubbed providers": stubbing all three would exercise our own mocks, whereas the thing actually worth catching before launch is a misregistered redirect URI, which only real providers reveal. The trade-off is that it does not run in CI.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`
- Test: `src/lib/scaffold.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `pnpm typecheck`, `pnpm test`, `pnpm dev` commands used by every later task

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "contributor-registry",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "migrate": "node migrations/run.ts"
  },
  "dependencies": {
    "next": "16.2.12",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "openid-client": "6.8.4",
    "iron-session": "8.0.4",
    "pg": "8.22.0",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@types/node": "24.10.1",
    "@types/pg": "8.20.0",
    "@types/react": "19.2.8",
    "@types/react-dom": "19.2.3",
    "typescript": "5.9.3",
    "vitest": "4.1.10"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `pnpm install`
Expected: a lockfile is written and `node_modules/` appears. If any pinned version above no longer resolves, install the closest available patch and record the actual version in the commit message.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {}

export default config
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'migrations/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Every test file talks to the one contributor_registry_test database,
    // and the migration test drops the contributors table in its beforeEach.
    // Run files one at a time.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': new URL('./src/', import.meta.url).pathname },
  },
})
```

The `migrations/` glob matters: Task 2's migration-runner test lives there and would otherwise never run. `fileParallelism: false` matters just as much: the whole suite shares one test database, and the migration test drops `contributors` in its `beforeEach`, so concurrent files fail intermittently with `relation "contributors" does not exist`.

- [ ] **Step 6: Create the test environment**

`src/lib/env.ts` (Task 2) validates every variable at import time and throws when one is missing. Any test that reaches it — directly or through `db.ts` or `session.ts` — needs a populated environment. Node 24 reads env files natively, so no `dotenv` dependency is needed.

Create `.env.test`:

```
DATABASE_URL=postgresql://localhost:5432/contributor_registry_test
SESSION_PASSWORD=test-password-at-least-32-characters-long
APP_URL=http://localhost:3000
GITHUB_CLIENT_ID=test-github-client-id
GITHUB_CLIENT_SECRET=test-github-client-secret
DISCORD_CLIENT_ID=test-discord-client-id
DISCORD_CLIENT_SECRET=test-discord-client-secret
TELEGRAM_CLIENT_ID=test-telegram-client-id
TELEGRAM_CLIENT_SECRET=test-telegram-client-secret
```

These are fake credentials for tests only — the file is committed on purpose so the suite runs on a fresh checkout. Real secrets live in `.env.local`, which is gitignored.

Create `tests/setup.ts`:

```typescript
process.loadEnvFile('.env.test')
```

- [ ] **Step 7: Create `.gitignore`**

```
node_modules/
.next/
.env.local
.env*.local
next-env.d.ts
*.tsbuildinfo
```

`.env.test` is not ignored: `.env*.local` only covers `.local` files.

- [ ] **Step 8: Write a scaffold test**

Create `src/lib/scaffold.test.ts`:

```typescript
import { expect, test } from 'vitest'

test('the toolchain runs TypeScript tests', () => {
  const version: string = process.version
  expect(version.startsWith('v24.')).toBe(true)
})
```

- [ ] **Step 9: Run the test**

Run: `pnpm test`
Expected: PASS, 1 test.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts vitest.config.ts .gitignore .env.test tests/setup.ts src/lib/scaffold.test.ts
git commit -m "chore: scaffold the Next.js and Vitest toolchain"
```

---

### Task 2: Environment, database, and schema

**Files:**
- Create: `src/lib/env.ts`, `src/lib/db.ts`, `migrations/001_contributors.sql`, `migrations/run.ts`, `.env.example`
- Test: `migrations/run.test.ts`

**Interfaces:**
- Consumes: the toolchain from Task 1
- Produces:
  - `env: { DATABASE_URL, SESSION_PASSWORD, APP_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, TELEGRAM_CLIENT_ID, TELEGRAM_CLIENT_SECRET }` from `@/lib/env`
  - `pool: pg.Pool` from `@/lib/db`
  - `migrate(databaseUrl: string): Promise<string[]>` from `migrations/run.ts`, returning the filenames applied

- [ ] **Step 1: Install and start PostgreSQL 18**

```bash
brew install postgresql@18
brew services start postgresql@18
/opt/homebrew/opt/postgresql@18/bin/createdb contributor_registry
/opt/homebrew/opt/postgresql@18/bin/createdb contributor_registry_test
```

Verify: `/opt/homebrew/opt/libpq/bin/pg_isready -h localhost -p 5432`
Expected: `localhost:5432 - accepting connections`

- [ ] **Step 2: Create `.env.example`**

```
DATABASE_URL=postgresql://localhost:5432/contributor_registry
# At least 32 characters. Generate with: openssl rand -base64 32
SESSION_PASSWORD=
APP_URL=http://localhost:3000
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
TELEGRAM_CLIENT_ID=
TELEGRAM_CLIENT_SECRET=
```

Then `cp .env.example .env.local` and fill `DATABASE_URL`, `SESSION_PASSWORD`, and `APP_URL`. Provider credentials stay empty until Task 10. The test database is configured separately in `.env.test` from Task 1.

- [ ] **Step 3: Create `src/lib/env.ts`**

```typescript
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_PASSWORD: z.string().min(32, 'SESSION_PASSWORD must be at least 32 characters'),
  APP_URL: z.url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  TELEGRAM_CLIENT_ID: z.string().min(1),
  TELEGRAM_CLIENT_SECRET: z.string().min(1),
})

export const env = schema.parse(process.env)
```

Note the Zod 4 API: `z.url()` at the top level, not the deprecated `z.string().url()`.

- [ ] **Step 4: Create `src/lib/db.ts`**

```typescript
import pg from 'pg'
import { env } from '@/lib/env'

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
```

- [ ] **Step 5: Create `migrations/001_contributors.sql`**

```sql
CREATE TABLE contributors (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id         bigint      NOT NULL UNIQUE,
  github_login      text        NOT NULL,
  telegram_id       bigint      UNIQUE,
  telegram_username text,
  telegram_phone    text,
  discord_id        text        UNIQUE,
  discord_username  text,
  first_name        text        NOT NULL,
  last_name         text        NOT NULL,
  email             text        NOT NULL,
  company           text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
```

`gen_random_uuid()` is built into PostgreSQL 13 and later — no extension needed.

- [ ] **Step 6: Write the failing migration-runner test**

Create `migrations/run.test.ts`:

```typescript
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
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm test migrations/run.test.ts`
Expected: FAIL — `run.ts` does not exist.

- [ ] **Step 8: Create `migrations/run.ts`**

```typescript
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = dirname(fileURLToPath(import.meta.url))

/** Applies every unapplied .sql file in this directory, in filename order. */
export async function migrate(databaseUrl: string): Promise<string[]> {
  const pool = new pg.Pool({ connectionString: databaseUrl })
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const { rows } = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations')
    const done = new Set(rows.map((r) => r.filename))

    const files = (await readdir(here)).filter((f) => f.endsWith('.sql')).sort()
    const applied: string[] = []

    for (const file of files) {
      if (done.has(file)) continue
      const sql = await readFile(join(here, file), 'utf8')
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
        await client.query('COMMIT')
        applied.push(file)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    return applied
  } finally {
    await pool.end()
  }
}

if (import.meta.filename === process.argv[1]) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const applied = await migrate(url)
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Nothing to apply')
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm test migrations/run.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 10: Apply the migration to the development database**

Run: `DATABASE_URL=postgresql://localhost:5432/contributor_registry pnpm migrate`
Expected: `Applied: 001_contributors.sql`

- [ ] **Step 11: Commit**

```bash
git add src/lib/env.ts src/lib/db.ts migrations/ .env.example
git commit -m "feat: add the contributors schema and migration runner"
```

---

### Task 3: Contributors module

**Files:**
- Create: `src/lib/contributors.ts`
- Test: `src/lib/contributors.test.ts`

**Interfaces:**
- Consumes: `pool` from `@/lib/db`, the `contributors` table from Task 2
- Produces, from `@/lib/contributors`:
  - `interface ContributorInput` — see Step 1
  - `interface Contributor extends ContributorInput { id: string; createdAt: Date; updatedAt: Date }`
  - `class AccountAlreadyLinkedError extends Error { provider: 'telegram' | 'discord' }`
  - `findByGithubId(githubId: string): Promise<Contributor | null>`
  - `upsert(input: ContributorInput): Promise<Contributor>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/contributors.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/lib/contributors.test.ts`
Expected: FAIL — `./contributors.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/contributors.ts`:

```typescript
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
 * read-modify-write cycle to interleave.
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
         telegram_id       = EXCLUDED.telegram_id,
         telegram_username = EXCLUDED.telegram_username,
         telegram_phone    = EXCLUDED.telegram_phone,
         discord_id        = EXCLUDED.discord_id,
         discord_username  = EXCLUDED.discord_username,
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/contributors.test.ts`
Expected: PASS, 6 tests. The suite talks to `contributor_registry_test`, because `tests/setup.ts` loads `.env.test` before `db.ts` reads `DATABASE_URL`. Run the migration against the test database first if this is a fresh checkout: `DATABASE_URL=postgresql://localhost:5432/contributor_registry_test pnpm migrate`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contributors.ts src/lib/contributors.test.ts
git commit -m "feat: add contributor read and upsert with linked-account guards"
```

---

### Task 4: Session

**Files:**
- Create: `src/lib/session.ts`
- Test: `src/lib/session.test.ts`

**Interfaces:**
- Consumes: `env` from `@/lib/env`
- Produces, from `@/lib/session`:
  - `interface SessionData { github?: { id: string; login: string }; pending?: { telegram?: Identity; discord?: Identity }; oauth?: { provider: ProviderName; codeVerifier: string; state: string; variant?: 'phone' }; error?: string }`
  - `sessionOptions: SessionOptions`
  - `getSession(): Promise<IronSession<SessionData>>`

`Identity` is reused from `@/lib/providers/types` rather than redeclared here — a pending link is exactly what a provider returned, and two structurally identical types would drift.

- [ ] **Step 1: Write the failing test**

Create `src/lib/session.test.ts`. It exercises the sealing round-trip directly, because `getSession()` needs a Next.js request context that unit tests do not have:

```typescript
import { expect, test } from 'vitest'
import { sealData, unsealData } from 'iron-session'
import { env } from '@/lib/env'
import { sessionOptions } from './session.ts'
import type { SessionData } from './session.ts'

test('the cookie is not marked secure over http, and httpOnly is on', () => {
  // Made explicit rather than assumed: this test's meaning depends on
  // .env.test setting APP_URL to an http:// URL. If that ever changes to
  // https, this assertion should fail loudly here rather than the `secure`
  // assertion below silently flipping to true and passing for the wrong reason.
  expect(env.APP_URL.startsWith('http://')).toBe(true)

  expect(sessionOptions.cookieOptions?.secure).toBe(false)
  expect(sessionOptions.cookieOptions?.httpOnly).toBe(true)
})

test('a session round-trips through sealing intact', async () => {
  const data: SessionData = {
    github: { id: '1001', login: 'octocat' },
    pending: { telegram: { providerId: '555', username: 'ada' } },
  }

  const sealed = await sealData(data, { password: sessionOptions.password })
  const opened = await unsealData<SessionData>(sealed, { password: sessionOptions.password })

  expect(opened.github?.login).toBe('octocat')
  expect(opened.pending?.telegram?.username).toBe('ada')
})

test('the cookie leaks nothing without the password', async () => {
  const data: SessionData = { github: { id: '1001', login: 'octocat' } }
  const sealed = await sealData(data, { password: sessionOptions.password })

  // The payload is encrypted, not merely signed, so the login must not appear.
  expect(sealed).not.toContain('octocat')

  // iron-session does not throw on a bad password — it recovers nothing.
  const opened = await unsealData<SessionData>(sealed, { password: 'a'.repeat(32) })
  expect(opened.github).toBeUndefined()
})
```

Both assertions here are load-bearing. `unsealData` does **not** reject on a wrong password: `iron-session` 8.0.4 catches `Bad hmac value` and returns `{}`, so an assertion that it throws can never pass. And the sealed payload must actually contain `octocat` for the `not.toContain` check to mean anything.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/lib/session.test.ts`
Expected: FAIL — `./session.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/session.ts`:

```typescript
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import type { Identity, ProviderName } from '@/lib/providers/types'

export interface SessionData {
  github?: { id: string; login: string }
  /** Links made in this session, held here until the form is submitted. */
  pending?: { telegram?: Identity; discord?: Identity }
  /** The in-flight authorization request. */
  oauth?: { provider: ProviderName; codeVerifier: string; state: string; variant?: 'phone' }
  error?: string
}

export const sessionOptions: SessionOptions = {
  password: env.SESSION_PASSWORD,
  cookieName: 'contributor_registry_session',
  cookieOptions: {
    secure: env.APP_URL.startsWith('https://'),
    httpOnly: true,
    sameSite: 'lax',
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/session.test.ts`
Expected: PASS, 3 tests.

Note: `src/lib/providers/types.ts` does not exist yet, so `pnpm typecheck` will fail on the `Identity` and `ProviderName` imports until Task 5. The tests pass because Vitest strips types without resolving them. Do not create a stub — Task 5 supplies the real module.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/lib/session.test.ts
git commit -m "feat: add the encrypted session holding identity and pending links"
```

---

### Task 5: Provider contract and GitHub

**Files:**
- Create: `src/lib/providers/types.ts`, `src/lib/providers/github.ts`
- Test: `src/lib/providers/github.test.ts`

**Interfaces:**
- Consumes: `env` from `@/lib/env`
- Produces, from `@/lib/providers/types`:
  - `type ProviderName = 'github' | 'discord' | 'telegram'`
  - `interface Identity { providerId: string; username?: string; phone?: string }`
  - `interface AuthRequest { url: URL; codeVerifier: string; state: string }`
  - `interface Provider { name: ProviderName; authRequest(redirectUri: string, variant?: 'phone'): Promise<AuthRequest>; callback(currentUrl: URL, redirectUri: string, codeVerifier: string, state: string): Promise<Identity> }`
- Produces, from `@/lib/providers/github`: `github: Provider`, `toIdentity(profile: unknown): Identity`

The design spec names the pair `getAuthUrl()` / `handleCallback()`. The plan widens the first to return the PKCE verifier and state alongside the URL, because the route handler has to put both in the session before redirecting.

- [ ] **Step 1: Write the failing test**

Create `src/lib/providers/github.test.ts`:

```typescript
import { expect, test } from 'vitest'
import { toIdentity } from './github.ts'

test('takes the numeric id and login from a github profile', () => {
  const identity = toIdentity({ id: 583231, login: 'octocat', name: 'The Octocat' })
  expect(identity).toEqual({ providerId: '583231', username: 'octocat' })
})

test('keeps the id as a string so large ids survive intact', () => {
  const identity = toIdentity({ id: 9007199254740993, login: 'big' })
  expect(typeof identity.providerId).toBe('string')
})

test('rejects a profile with no login', () => {
  expect(() => toIdentity({ id: 1 })).toThrow(/login/)
})

test('rejects a profile with no id', () => {
  expect(() => toIdentity({ login: 'octocat' })).toThrow(/id/)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/lib/providers/github.test.ts`
Expected: FAIL — `./github.ts` does not exist.

- [ ] **Step 3: Create `src/lib/providers/types.ts`**

```typescript
export type ProviderName = 'github' | 'discord' | 'telegram'

/** Everything we are willing to take from a provider. */
export interface Identity {
  providerId: string
  username?: string
  phone?: string
}

export interface AuthRequest {
  url: URL
  codeVerifier: string
  state: string
}

export interface Provider {
  name: ProviderName
  /** `variant` exists for Telegram's second pass, which asks for a phone. */
  authRequest(redirectUri: string, variant?: 'phone'): Promise<AuthRequest>
  callback(currentUrl: URL, redirectUri: string, codeVerifier: string, state: string): Promise<Identity>
}
```

- [ ] **Step 4: Create `src/lib/providers/github.ts`**

```typescript
import * as client from 'openid-client'
import { z } from 'zod'
import { env } from '@/lib/env'
import type { AuthRequest, Identity, Provider } from '@/lib/providers/types'

const profileSchema = z.object({
  id: z.number(),
  login: z.string().min(1),
})

export function toIdentity(profile: unknown): Identity {
  const parsed = profileSchema.parse(profile)
  return { providerId: String(parsed.id), username: parsed.login }
}

/**
 * GitHub answers the token endpoint with form-encoded data unless the request
 * asks for JSON, so every request from this client carries the header.
 *
 * The type is `client.CustomFetch`, not `typeof fetch`: openid-client's own
 * body type is `Uint8Array<ArrayBufferLike>`, which the DOM lib's `BodyInit`
 * does not structurally accept. Every member of the library's `FetchBody` is a
 * valid runtime fetch body, so the assertion is inert — the library documents
 * this friction and suggests suppressing it at the `fetch` call.
 */
const jsonFetch: client.CustomFetch = (url, options) => {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  return fetch(url, { ...options, headers } as RequestInit)
}

function configuration(): client.Configuration {
  const config = new client.Configuration(
    {
      issuer: 'https://github.com',
      authorization_endpoint: 'https://github.com/login/oauth/authorize',
      token_endpoint: 'https://github.com/login/oauth/access_token',
    },
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
  )
  config[client.customFetch] = jsonFetch
  return config
}

export const github: Provider = {
  name: 'github',

  async authRequest(redirectUri: string): Promise<AuthRequest> {
    const config = configuration()
    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
    const state = client.randomState()

    // No scope: an empty scope already grants read access to the public
    // profile, which is where `login` lives. Anything more would be surplus.
    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    return { url, codeVerifier, state }
  },

  async callback(currentUrl, _redirectUri, codeVerifier, state): Promise<Identity> {
    const config = configuration()
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
    })

    const response = await client.fetchProtectedResource(
      config,
      tokens.access_token,
      new URL('https://api.github.com/user'),
      'GET',
    )

    return toIdentity(await response.json())
  },
}
```

`_redirectUri` is unused here — GitHub only needs it on the authorization request — but the contract keeps the parameter because it is part of a shared interface.

- [ ] **Step 5: Run the unit tests to verify they pass**

Run: `pnpm test src/lib/providers/github.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Write the failing transport integration test**

This is the one test that drives a whole authorization round trip — building the URL, exchanging the code, and fetching the profile — with the network replaced. GitHub is the subject because it has no JWT to forge. Create `tests/github-transport.test.ts`:

```typescript
import { expect, test, vi } from 'vitest'
import { github } from '@/lib/providers/github'

test('builds an authorization url carrying PKCE and state', async () => {
  const request = await github.authRequest('http://localhost:3000/auth/github/callback')

  expect(request.url.origin + request.url.pathname).toBe('https://github.com/login/oauth/authorize')
  expect(request.url.searchParams.get('client_id')).toBe('test-github-client-id')
  expect(request.url.searchParams.get('code_challenge_method')).toBe('S256')
  expect(request.url.searchParams.get('code_challenge')).toBeTruthy()
  expect(request.url.searchParams.get('state')).toBe(request.state)
  // No scope: the public profile is readable without one.
  expect(request.url.searchParams.get('scope')).toBeNull()
  expect(request.codeVerifier.length).toBeGreaterThan(20)
})

test('exchanges the code and returns identity only', async () => {
  const calls: string[] = []

  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    calls.push(url)

    if (url.startsWith('https://github.com/login/oauth/access_token')) {
      return new Response(JSON.stringify({ access_token: 'gho_test', token_type: 'bearer' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url.startsWith('https://api.github.com/user')) {
      return new Response(
        JSON.stringify({ id: 583231, login: 'octocat', email: 'secret@example.com', avatar_url: 'https://x/y.png' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }
    throw new Error(`unexpected request: ${url}`)
  })

  vi.stubGlobal('fetch', fetchMock)

  const request = await github.authRequest('http://localhost:3000/auth/github/callback')
  const callbackUrl = new URL(
    `http://localhost:3000/auth/github/callback?code=abc123&state=${request.state}`,
  )

  const identity = await github.callback(
    callbackUrl,
    'http://localhost:3000/auth/github/callback',
    request.codeVerifier,
    request.state,
  )

  expect(identity).toEqual({ providerId: '583231', username: 'octocat' })
  // The profile carried an email and an avatar; neither survives the mapping.
  expect(Object.keys(identity).sort()).toEqual(['providerId', 'username'])
  expect(calls.some((c) => c.startsWith('https://github.com/login/oauth/access_token'))).toBe(true)

  vi.unstubAllGlobals()
})
```

- [ ] **Step 7: Run it**

Run: `pnpm test tests/github-transport.test.ts`
Expected: PASS, 2 tests. If the token exchange fails, check that `jsonFetch` sets `Accept: application/json` — the stub above only answers JSON.

- [ ] **Step 8: Verify types across the project**

Run: `pnpm typecheck`
Expected: clean. Task 4's `Identity` and `ProviderName` imports now resolve.

- [ ] **Step 9: Commit**

```bash
git add src/lib/providers/types.ts src/lib/providers/github.ts src/lib/providers/github.test.ts tests/github-transport.test.ts
git commit -m "feat: add the provider contract and the GitHub provider"
```

---

### Task 6: Discord provider

**Files:**
- Create: `src/lib/providers/discord.ts`
- Test: `src/lib/providers/discord.test.ts`

**Interfaces:**
- Consumes: `Provider`, `Identity`, `AuthRequest` from `@/lib/providers/types`
- Produces, from `@/lib/providers/discord`: `discord: Provider`, `toIdentity(profile: unknown): Identity`

- [ ] **Step 1: Write the failing test**

Create `src/lib/providers/discord.test.ts`:

```typescript
import { expect, test } from 'vitest'
import type { ZodError } from 'zod'
import { toIdentity } from './discord.ts'

test('takes the snowflake id and username', () => {
  const identity = toIdentity({ id: '80351110224678912', username: 'nelly', global_name: 'Nelly' })
  expect(identity).toEqual({ providerId: '80351110224678912', username: 'nelly' })
})

test('rejects a profile with no username', () => {
  expect(() => toIdentity({ id: '80351110224678912' })).toThrow(/username/)
})

test('rejects a profile with no id', () => {
  try {
    toIdentity({ username: 'nelly' })
    expect.unreachable('a profile with no id must be rejected')
  } catch (error) {
    // A /id/ regex on the message would also match Zod's "invalid_type" code,
    // so it passes for a missing username too. Assert the failing path instead.
    expect((error as ZodError).issues.map((issue) => issue.path)).toEqual([['id']])
  }
})
```

The `id` case asserts the failing field by path rather than by a message regex. Zod 4's error message embeds `"code": "invalid_type"`, whose text contains `id`, so `/id/` matches whichever field actually failed — verified against zod 4.4.3. `/username/` has no such collision and stays as a regex.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/lib/providers/discord.test.ts`
Expected: FAIL — `./discord.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/providers/discord.ts`:

```typescript
import * as client from 'openid-client'
import { z } from 'zod'
import { env } from '@/lib/env'
import type { AuthRequest, Identity, Provider } from '@/lib/providers/types'

/** Discord ids are snowflakes and already arrive as strings. */
const profileSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
})

export function toIdentity(profile: unknown): Identity {
  const parsed = profileSchema.parse(profile)
  return { providerId: parsed.id, username: parsed.username }
}

function configuration(): client.Configuration {
  return new client.Configuration(
    {
      issuer: 'https://discord.com',
      authorization_endpoint: 'https://discord.com/oauth2/authorize',
      token_endpoint: 'https://discord.com/api/oauth2/token',
    },
    env.DISCORD_CLIENT_ID,
    env.DISCORD_CLIENT_SECRET,
  )
}

export const discord: Provider = {
  name: 'discord',

  async authRequest(redirectUri: string): Promise<AuthRequest> {
    const config = configuration()
    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
    const state = client.randomState()

    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: 'identify',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    return { url, codeVerifier, state }
  },

  async callback(currentUrl, _redirectUri, codeVerifier, state): Promise<Identity> {
    const config = configuration()
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
    })

    const response = await client.fetchProtectedResource(
      config,
      tokens.access_token,
      new URL('https://discord.com/api/users/@me'),
      'GET',
    )

    return toIdentity(await response.json())
  },
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/providers/discord.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/discord.ts src/lib/providers/discord.test.ts
git commit -m "feat: add the Discord provider"
```

---

### Task 7: Telegram provider

**Files:**
- Create: `src/lib/providers/telegram.ts`, `src/lib/providers/index.ts`
- Test: `src/lib/providers/telegram.test.ts`

**Interfaces:**
- Consumes: `Provider`, `Identity`, `AuthRequest`, `ProviderName` from `@/lib/providers/types`; `github`; `discord`
- Produces:
  - from `@/lib/providers/telegram`: `telegram: Provider`, `toIdentity(claims: unknown): Identity`
  - from `@/lib/providers/index`: `providers: Record<ProviderName, Provider>`, `isProviderName(value: string): value is ProviderName`

Telegram is the only OIDC provider of the three: it publishes discovery at `https://oauth.telegram.org/.well-known/openid-configuration`, and the username arrives as the `preferred_username` claim of a signed `id_token`. Validating that signature against Telegram's JWKS is `openid-client`'s job — `authorizationCodeGrant` does it, and `tokens.claims()` returns the verified claim set.

- [ ] **Step 1: Write the failing test**

Create `src/lib/providers/telegram.test.ts`:

```typescript
import { expect, test } from 'vitest'
import { toIdentity } from './telegram.ts'

test('prefers the username when the account has one', () => {
  const identity = toIdentity({ sub: '4242', preferred_username: 'ada' })
  expect(identity).toEqual({ providerId: '4242', username: 'ada' })
})

test('falls back to the phone number when there is no username', () => {
  const identity = toIdentity({ sub: '4242', phone_number: '+359888123456' })
  expect(identity).toEqual({ providerId: '4242', phone: '+359888123456' })
})

test('keeps only the username when both are present', () => {
  const identity = toIdentity({ sub: '4242', preferred_username: 'ada', phone_number: '+359888123456' })
  expect(identity).toEqual({ providerId: '4242', username: 'ada' })
})

test('returns neither when the account has no username and no phone consent', () => {
  const identity = toIdentity({ sub: '4242' })
  expect(identity).toEqual({ providerId: '4242' })
})

test('rejects claims with no subject', () => {
  expect(() => toIdentity({ preferred_username: 'ada' })).toThrow(/sub/)
})
```

The third case matters: asking for a phone is a privacy cost, so once a username exists the phone is dropped rather than stored alongside it.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/lib/providers/telegram.test.ts`
Expected: FAIL — `./telegram.ts` does not exist.

- [ ] **Step 3: Create `src/lib/providers/telegram.ts`**

```typescript
import * as client from 'openid-client'
import { z } from 'zod'
import { env } from '@/lib/env'
import type { AuthRequest, Identity, Provider } from '@/lib/providers/types'

const claimsSchema = z.object({
  sub: z.string().min(1),
  preferred_username: z.string().min(1).optional(),
  phone_number: z.string().min(1).optional(),
})

/**
 * A Telegram account need not have an @username, so the phone number — asked
 * for only on a second pass, with the user's consent — stands in as the
 * identifier. When a username exists the phone is discarded.
 */
export function toIdentity(claims: unknown): Identity {
  const parsed = claimsSchema.parse(claims)
  if (parsed.preferred_username) {
    return { providerId: parsed.sub, username: parsed.preferred_username }
  }
  if (parsed.phone_number) {
    return { providerId: parsed.sub, phone: parsed.phone_number }
  }
  return { providerId: parsed.sub }
}

let cached: Promise<client.Configuration> | undefined

/**
 * `??=` alone would memoise a rejected promise forever — a rejection is not
 * nullish, so a transient discovery failure would wedge Telegram linking for
 * the process's whole lifetime. Instead: assign the in-flight promise
 * synchronously (so concurrent callers still share one discovery request),
 * then clear the cache on rejection — but only if nobody has since started a
 * newer attempt — so a later call can retry instead of replaying the failure.
 */
function configuration(): Promise<client.Configuration> {
  if (!cached) {
    const attempt = client.discovery(
      new URL('https://oauth.telegram.org'),
      env.TELEGRAM_CLIENT_ID,
      env.TELEGRAM_CLIENT_SECRET,
    )
    attempt.catch(() => {
      if (cached === attempt) cached = undefined
    })
    cached = attempt
  }
  return cached
}

export const telegram: Provider = {
  name: 'telegram',

  async authRequest(redirectUri: string, variant?: 'phone'): Promise<AuthRequest> {
    const config = await configuration()
    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
    const state = client.randomState()

    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: variant === 'phone' ? 'openid phone' : 'openid profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    return { url, codeVerifier, state }
  },

  async callback(currentUrl, _redirectUri, codeVerifier, state): Promise<Identity> {
    const config = await configuration()
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
    })

    const claims = tokens.claims()
    if (!claims) throw new Error('Telegram returned no id_token')

    return toIdentity(claims)
  },
}
```

- [ ] **Step 4: Create `src/lib/providers/index.ts`**

```typescript
import { discord } from '@/lib/providers/discord'
import { github } from '@/lib/providers/github'
import { telegram } from '@/lib/providers/telegram'
import type { Provider, ProviderName } from '@/lib/providers/types'

export const providers: Record<ProviderName, Provider> = { github, discord, telegram }

export function isProviderName(value: string): value is ProviderName {
  return value === 'github' || value === 'discord' || value === 'telegram'
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test src/lib/providers/`
Expected: PASS — 12 tests across the three provider files.

- [ ] **Step 6: Commit**

```bash
git add src/lib/providers/telegram.ts src/lib/providers/telegram.test.ts src/lib/providers/index.ts
git commit -m "feat: add the Telegram provider with username-or-phone identity"
```

---

### Task 8: Authorization routes

**Files:**
- Create: `src/app/auth/[provider]/route.ts`, `src/app/auth/[provider]/callback/route.ts`
- Test: `tests/auth-routes.test.ts`

**Interfaces:**
- Consumes: `providers`, `isProviderName`, `getSession`, `env`
- Produces: `GET /auth/:provider` and `GET /auth/:provider/callback`

Behaviour:

1. `GET /auth/:provider` — optional `?variant=phone`. Builds the authorization request, stores `{ provider, codeVerifier, state, variant }` in the session, redirects to the provider.
2. `GET /auth/:provider/callback` — reads the stored transaction, refuses if it is missing or names a different provider, exchanges the code, then:
   - **github** — sets `session.github`, the sign-in.
   - **discord** — sets `session.pending.discord`.
   - **telegram** — if the identity has a username, sets `session.pending.telegram`. If it has neither username nor phone and the variant was not `phone`, redirects to `/auth/telegram?variant=phone` for the second pass. If the variant was already `phone` and there is still nothing, sets `session.error`.
   - Always clears `session.oauth` and redirects to `/`.

- [ ] **Step 1: Write the failing test**

Create `tests/auth-routes.test.ts`. It tests the decision the routes make, isolated from the Next.js runtime:

```typescript
import { expect, test } from 'vitest'
import { resolveTelegramOutcome } from '@/app/auth/[provider]/callback/outcome'

test('a username completes the telegram link', () => {
  const outcome = resolveTelegramOutcome({ providerId: '1', username: 'ada' }, undefined)
  expect(outcome).toEqual({ kind: 'link', identity: { providerId: '1', username: 'ada' } })
})

test('no username on the first pass asks for a phone', () => {
  const outcome = resolveTelegramOutcome({ providerId: '1' }, undefined)
  expect(outcome).toEqual({ kind: 'retry-with-phone' })
})

test('a phone on the second pass completes the link', () => {
  const outcome = resolveTelegramOutcome({ providerId: '1', phone: '+359888123456' }, 'phone')
  expect(outcome).toEqual({ kind: 'link', identity: { providerId: '1', phone: '+359888123456' } })
})

test('nothing on the second pass is an explained failure', () => {
  const outcome = resolveTelegramOutcome({ providerId: '1' }, 'phone')
  expect(outcome.kind).toBe('failed')
  if (outcome.kind === 'failed') expect(outcome.message).toMatch(/username|phone/i)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test tests/auth-routes.test.ts`
Expected: FAIL — the `outcome` module does not exist.

- [ ] **Step 3: Create `src/app/auth/[provider]/callback/outcome.ts`**

```typescript
import type { Identity } from '@/lib/providers/types'

export type TelegramOutcome =
  | { kind: 'link'; identity: Identity }
  | { kind: 'retry-with-phone' }
  | { kind: 'failed'; message: string }

/**
 * Telegram is asked for a phone only when the account turns out to have no
 * @username — so the first pass requests `profile`, and only a blank result
 * escalates to `phone`.
 */
export function resolveTelegramOutcome(identity: Identity, variant: 'phone' | undefined): TelegramOutcome {
  if (identity.username || identity.phone) return { kind: 'link', identity }
  if (variant !== 'phone') return { kind: 'retry-with-phone' }
  return {
    kind: 'failed',
    message: 'Your Telegram account has no username, and no phone number was shared, so it could not be linked.',
  }
}
```

- [ ] **Step 4: Create `src/app/auth/[provider]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { isProviderName, providers } from '@/lib/providers'
import { getSession } from '@/lib/session'

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await context.params
  if (!isProviderName(name)) return new NextResponse('Unknown provider', { status: 404 })

  const variant = new URL(request.url).searchParams.get('variant') === 'phone' ? 'phone' : undefined
  const redirectUri = `${env.APP_URL}/auth/${name}/callback`

  const provider = providers[name]
  const { url, codeVerifier, state } = await provider.authRequest(redirectUri, variant)

  const session = await getSession()
  session.oauth = { provider: name, codeVerifier, state, variant }
  await session.save()

  return NextResponse.redirect(url)
}
```

- [ ] **Step 5: Create `src/app/auth/[provider]/callback/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { isProviderName, providers } from '@/lib/providers'
import { getSession } from '@/lib/session'
import { resolveTelegramOutcome } from './outcome'

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await context.params
  if (!isProviderName(name)) return new NextResponse('Unknown provider', { status: 404 })

  const session = await getSession()
  const transaction = session.oauth
  const home = new URL('/', env.APP_URL)

  // A callback with no matching transaction is a replay or a stale tab.
  if (!transaction || transaction.provider !== name) {
    session.error = 'That sign-in link has expired. Please try again.'
    session.oauth = undefined
    await session.save()
    return NextResponse.redirect(home)
  }

  const redirectUri = `${env.APP_URL}/auth/${name}/callback`
  session.oauth = undefined

  let identity
  try {
    identity = await providers[name].callback(
      new URL(request.url),
      redirectUri,
      transaction.codeVerifier,
      transaction.state,
    )
  } catch (error) {
    // Covers a cancelled authorization, a state or PKCE mismatch, and a
    // provider error alike: the contributor gets one identical, generic
    // message either way, but the container's logs keep the real cause so a
    // genuine regression is distinguishable from someone clicking "cancel".
    console.error(`auth callback error (${name}):`, error)
    session.error = `Linking ${name} did not complete. Please try again.`
    await session.save()
    return NextResponse.redirect(home)
  }

  if (name === 'github') {
    // `username` is optional on Identity; it is populated here only because
    // github.ts's toIdentity currently guarantees it. That guarantee lives in
    // another module and isn't visible to the compiler here, so it is
    // re-checked at runtime rather than asserted — an absent username fails
    // the same way every other provider error already does, instead of
    // writing `login: undefined` into a session field typed `string`.
    if (!identity.username) {
      console.error(`github callback: identity had no username (providerId=${identity.providerId})`)
      session.error = `Linking ${name} did not complete. Please try again.`
      await session.save()
      return NextResponse.redirect(home)
    }
    session.github = { id: identity.providerId, login: identity.username }
    session.error = undefined
    await session.save()
    return NextResponse.redirect(home)
  }

  if (name === 'discord') {
    session.pending = { ...session.pending, discord: identity }
    session.error = undefined
    await session.save()
    return NextResponse.redirect(home)
  }

  const outcome = resolveTelegramOutcome(identity, transaction.variant)
  if (outcome.kind === 'retry-with-phone') {
    await session.save()
    return NextResponse.redirect(new URL('/auth/telegram?variant=phone', env.APP_URL))
  }
  if (outcome.kind === 'failed') {
    session.error = outcome.message
    await session.save()
    return NextResponse.redirect(home)
  }

  session.pending = { ...session.pending, telegram: outcome.identity }
  session.error = undefined
  await session.save()
  return NextResponse.redirect(home)
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test tests/auth-routes.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Verify types**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/app/auth tests/auth-routes.test.ts
git commit -m "feat: add authorization start and callback routes"
```

---

### Task 9: The page and the save action

**Files:**
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/form.tsx`, `src/app/form-schema.ts`, `src/app/actions.ts`, `src/app/globals.css`
- Test: `src/app/form-schema.test.ts`

**Interfaces:**
- Consumes: `getSession`, `findByGithubId`, `upsert`, `AccountAlreadyLinkedError`
- Produces, from `@/app/form-schema`:
  - `interface SaveResult { ok: boolean; message?: string }`
  - `parseForm(form: FormData): { firstName: string; lastName: string; email: string; company?: string }` — throws `z.ZodError` on bad input
- Produces, from `@/app/actions`:
  - `save(_prev: SaveResult, form: FormData): Promise<SaveResult>` — a server action

The schema lives apart from the action on purpose: a `'use server'` module may only export async functions, so a synchronous `parseForm` exported from `actions.ts` would fail the build.

The page has three states: signed out (a GitHub button), signed in (the form with link buttons), and saved (a confirmation with a way back). A saved contributor returning later sees their record pre-filled, which is the same signed-in state reading from the database.

- [ ] **Step 1: Write the failing test**

Create `src/app/form-schema.test.ts`:

```typescript
import { expect, test } from 'vitest'
import { parseForm } from './form-schema.ts'

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

test('accepts a complete form', () => {
  const parsed = parseForm(
    form({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Analytical Engines' }),
  )
  expect(parsed).toEqual({
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    company: 'Analytical Engines',
  })
})

test('treats a blank company as absent', () => {
  const parsed = parseForm(form({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: '  ' }))
  expect(parsed.company).toBeUndefined()
})

test('rejects a malformed email', () => {
  expect(() => parseForm(form({ firstName: 'Ada', lastName: 'Lovelace', email: 'not-an-email' }))).toThrow()
})

test('rejects a missing first name', () => {
  expect(() => parseForm(form({ lastName: 'Lovelace', email: 'ada@example.com' }))).toThrow()
})

test('trims surrounding whitespace', () => {
  const parsed = parseForm(form({ firstName: ' Ada ', lastName: ' Lovelace ', email: ' ada@example.com ' }))
  expect(parsed.firstName).toBe('Ada')
  expect(parsed.email).toBe('ada@example.com')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/app/form-schema.test.ts`
Expected: FAIL — `./form-schema.ts` does not exist.

- [ ] **Step 3: Create `src/app/form-schema.ts`**

```typescript
import { z } from 'zod'

export interface SaveResult {
  ok: boolean
  message?: string
}

const formSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.email('That does not look like an email address'),
  company: z
    .string()
    .trim()
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
})

export function parseForm(form: FormData): z.infer<typeof formSchema> {
  return formSchema.parse({
    firstName: form.get('firstName') ?? '',
    lastName: form.get('lastName') ?? '',
    email: typeof form.get('email') === 'string' ? (form.get('email') as string).trim() : '',
    company: form.get('company') ?? '',
  })
}
```

- [ ] **Step 4: Create `src/app/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { AccountAlreadyLinkedError, findByGithubId, upsert } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { parseForm, type SaveResult } from '@/app/form-schema'

export async function save(_prev: SaveResult, form: FormData): Promise<SaveResult> {
  const session = await getSession()
  if (!session.github) return { ok: false, message: 'Please sign in with GitHub first.' }

  let fields
  try {
    fields = parseForm(form)
  } catch (error) {
    const issue = error instanceof z.ZodError ? error.issues[0]?.message : undefined
    return { ok: false, message: issue ?? 'Please check the form and try again.' }
  }

  // Existing links come from the record; links made in this session win.
  const existing = await findByGithubId(session.github.id)
  const telegram = session.pending?.telegram
  const discord = session.pending?.discord

  try {
    await upsert({
      githubId: session.github.id,
      githubLogin: session.github.login,
      telegramId: telegram?.providerId ?? existing?.telegramId,
      telegramUsername: telegram ? telegram.username : existing?.telegramUsername,
      telegramPhone: telegram ? telegram.phone : existing?.telegramPhone,
      discordId: discord?.providerId ?? existing?.discordId,
      discordUsername: discord ? discord.username : existing?.discordUsername,
      ...fields,
    })
  } catch (error) {
    if (error instanceof AccountAlreadyLinkedError) return { ok: false, message: error.message }
    return { ok: false, message: 'Could not save right now. Please try again in a moment.' }
  }

  session.pending = undefined
  await session.save()
  revalidatePath('/')
  return { ok: true }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test src/app/form-schema.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Create `src/app/globals.css`**

```css
:root {
  color-scheme: light;
  --ink: #1a1a1a;
  --muted: #666;
  --line: #ddd;
  --ground: #fff;
}

body {
  margin: 0;
  padding: 3rem 1.5rem;
  background: var(--ground);
  color: var(--ink);
  font: 16px/1.6 system-ui, -apple-system, sans-serif;
}

main {
  max-width: 34rem;
  margin: 0 auto;
}

label {
  display: block;
  margin: 1rem 0 0.25rem;
  font-weight: 600;
}

input {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  font: inherit;
  box-sizing: border-box;
}

button,
.link-button {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.6rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--ink);
  color: var(--ground);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

.link-button {
  background: var(--ground);
  color: var(--ink);
  margin-right: 0.5rem;
}

.linked {
  color: var(--muted);
}

.error {
  padding: 0.75rem;
  border: 1px solid #c33;
  border-radius: 6px;
  color: #c33;
}
```

- [ ] **Step 7: Create `src/app/layout.tsx`**

```tsx
import type { ReactNode } from 'react'
import './globals.css'

export const metadata = { title: 'Contributor Registry' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 8: Create `src/app/page.tsx`**

```tsx
import { findByGithubId } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { ContributorForm } from './form'

export default async function Page() {
  const session = await getSession()
  const error = session.error

  if (!session.github) {
    return (
      <>
        <h1>Contributor registry</h1>
        <p>Sign in with GitHub to add or update your entry.</p>
        {error ? <p className="error">{error}</p> : null}
        <a className="link-button" href="/auth/github">
          Sign in with GitHub
        </a>
      </>
    )
  }

  const existing = await findByGithubId(session.github.id)
  const telegram = session.pending?.telegram ?? {
    providerId: existing?.telegramId ?? '',
    username: existing?.telegramUsername,
    phone: existing?.telegramPhone,
  }
  const discord = session.pending?.discord ?? {
    providerId: existing?.discordId ?? '',
    username: existing?.discordUsername,
  }

  return (
    <ContributorForm
      githubLogin={session.github.login}
      telegramLabel={telegram.username ? `@${telegram.username}` : (telegram.phone ?? null)}
      discordLabel={discord.username ?? null}
      defaults={{
        firstName: existing?.firstName ?? '',
        lastName: existing?.lastName ?? '',
        email: existing?.email ?? '',
        company: existing?.company ?? '',
      }}
      error={error}
    />
  )
}
```

- [ ] **Step 9: Create `src/app/form.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { save } from './actions'
import type { SaveResult } from './form-schema'

interface Props {
  githubLogin: string
  telegramLabel: string | null
  discordLabel: string | null
  defaults: { firstName: string; lastName: string; email: string; company: string }
  error?: string
}

const initial: SaveResult = { ok: false }

export function ContributorForm({ githubLogin, telegramLabel, discordLabel, defaults, error }: Props) {
  const [result, formAction, pending] = useActionState(save, initial)

  if (result.ok) {
    return (
      <>
        <h1>Thanks — you are on the list</h1>
        <p>Your entry has been saved. You can come back to this page any time to change it.</p>
        <a className="link-button" href="/">
          Edit my entry
        </a>
      </>
    )
  }

  return (
    <>
      <h1>Contributor registry</h1>
      <p>
        Signed in as <strong>@{githubLogin}</strong>
      </p>

      {error ? <p className="error">{error}</p> : null}
      {result.message ? <p className="error">{result.message}</p> : null}

      <p>
        {telegramLabel ? (
          <span className="linked">Telegram: {telegramLabel} · </span>
        ) : null}
        <a className="link-button" href="/auth/telegram">
          {telegramLabel ? 'Re-link Telegram' : 'Link Telegram'}
        </a>
        {discordLabel ? <span className="linked">Discord: {discordLabel} · </span> : null}
        <a className="link-button" href="/auth/discord">
          {discordLabel ? 'Re-link Discord' : 'Link Discord'}
        </a>
      </p>

      <form action={formAction}>
        <label htmlFor="firstName">First name</label>
        <input id="firstName" name="firstName" defaultValue={defaults.firstName} required />

        <label htmlFor="lastName">Last name</label>
        <input id="lastName" name="lastName" defaultValue={defaults.lastName} required />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" defaultValue={defaults.email} required />

        <label htmlFor="company">Company (optional)</label>
        <input id="company" name="company" defaultValue={defaults.company} />

        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </>
  )
}
```

`page.tsx` stays a server component so it can read the session and the database; `form.tsx` is the client boundary, needed for `useActionState`.

- [ ] **Step 10: Verify types and the full suite**

Run: `pnpm typecheck && pnpm test`
Expected: both clean.

- [ ] **Step 11: Check the page renders**

Run: `pnpm dev`, open `http://localhost:3000`.
Expected: the signed-out state with a GitHub button. The button will not work until Task 10 registers the OAuth applications — that is expected here.

- [ ] **Step 12: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/form.tsx src/app/form-schema.ts src/app/form-schema.test.ts src/app/actions.ts src/app/globals.css
git commit -m "feat: add the contributor form page and save action"
```

---

### Task 10: Provider registration, end-to-end check, and deployment artifacts

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `README.md`

**Interfaces:**
- Consumes: everything above
- Produces: a runnable image and the setup instructions a second person needs

This task is where the application first talks to real providers. Each registration needs the redirect URI to match exactly.

- [ ] **Step 1: Register the GitHub OAuth App**

At https://github.com/settings/developers → New OAuth App. Homepage `http://localhost:3000`, callback `http://localhost:3000/auth/github/callback`. Put the client id and secret in `.env.local`.

- [ ] **Step 2: Register the Discord application**

At https://discord.com/developers/applications → New Application → OAuth2. Add redirect `http://localhost:3000/auth/discord/callback`. Put the client id and secret in `.env.local`.

- [ ] **Step 3: Register the Telegram bot**

In [@BotFather](https://t.me/botfather) → `/newbot`, then Bot Settings → Web Login → add `http://localhost:3000/auth/telegram/callback` as an allowed URL. Put the client id and secret in `.env.local`.

- [ ] **Step 4: Walk the happy path by hand**

Run `pnpm dev`, then:
1. Sign in with GitHub → the form appears with your login shown.
2. Link Telegram → the label shows your `@username`, or a phone prompt if you have none.
3. Link Discord → the label shows your username.
4. Fill the form and save → the confirmation appears.
5. Reload `/` → the form is pre-filled from the database.

Verify the row holds identity only:

```bash
/opt/homebrew/opt/libpq/bin/psql "postgresql://localhost:5432/contributor_registry" \
  -c "SELECT github_login, telegram_username, telegram_phone, discord_username, email, company FROM contributors"
```

- [ ] **Step 5: Create `.dockerignore`**

```
node_modules
.next
.git
.env.local
docs
```

- [ ] **Step 6: Create the `Dockerfile`**

```dockerfile
FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json next.config.ts ./
COPY migrations ./migrations
EXPOSE 3000
CMD ["sh", "-c", "node migrations/run.ts && pnpm start"]
```

- [ ] **Step 7: Write the `README.md`**

Use the write-doc skill. It must cover: what the registry is and what it stores; local setup (PostgreSQL 18, `pnpm install`, `.env.local`, `pnpm migrate`, `pnpm dev`); how to register the three OAuth applications, including that each environment needs its own redirect URIs; how to read the collected data with `psql`; and how to deploy the image. Do not include an admin UI section — there is none by design.

- [ ] **Step 8: Commit**

```bash
git add Dockerfile .dockerignore README.md
git commit -m "feat: add the container image and setup documentation"
```

---

## Open decisions

Two things are outside the code and are not this plan's to settle:

1. **The production domain.** Task 10 registers `http://localhost:3000` callbacks. Every deployed environment needs its own registration at all three providers before it will work.
2. **A consent notice.** The registry stores names, email addresses, and in some cases phone numbers. Whether the form carries a stated purpose and a consent checkbox is a decision for the project, not a technical gap.
