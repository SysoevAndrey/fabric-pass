# Fabric Pass

Part of [Constructor Fabric](https://constructorfabric.org). Fabric Pass is a directory of an open-source project's contributors, collected through a single link. A contributor signs in with GitHub, which creates their one row immediately, keyed by GitHub account; from there, linking Telegram and/or Discord and filling in a short profile each autosave as they happen, with no separate save step. Returning and signing in again loads the existing row for correction.

The registry stores identity only: each linked provider's numeric ID (which never changes) and its current username — or, for a Telegram account with no username, a phone number given with consent. It stores no avatars, no provider-supplied names or emails, and no access or refresh tokens. There is no admin UI; the data is read directly from Postgres (see [Reading the data](#reading-the-data)).

## Data collected

The `contributors` table (`migrations/001_contributors.sql`, reshaped by `migrations/002_contributor_name_and_nullable_fields.sql` and `migrations/003_telegram_id_as_text.sql`):

| Column(s) | Notes |
|---|---|
| `github_id`, `github_login` | GitHub's numeric user ID (the record key, unique) and current login |
| `telegram_id`, `telegram_username`, `telegram_phone` | Telegram's ID (unique) — stored as text, since it isn't bounded to 64 bits the way a `bigint` is (`discord_id` below was already text for the same reason); current `@username`, or a phone number when the account has none |
| `discord_id`, `discord_username` | Discord's snowflake ID (unique) and current username |
| `name`, `email`, `company` | Entered directly in the form, one field at a time as it autosaves; all three are optional — a blank value clears the column |
| `created_at`, `updated_at` | Set automatically |

## Session outlives its row

A signed-in session's cookie can name a `github_id` no longer in the table, if the row is gone by the time a page load or an autosave reaches it. Signing in with GitHub again is always the fix, since that recreates the row. Two places surface this:

- Loading the page in that state shows the same signed-out view as someone who's never signed in, rather than a form with nothing behind it.
- The row disappearing while the form is already open surfaces on the next autosave: the field shows a "Sign in again" link alongside the save's error, since retrying the same save can never succeed once the row is gone.

Both read the same message, `REAUTH_REQUIRED_MESSAGE` in `src/app/auth/notice.ts`.

## Local setup

Prerequisites: a running PostgreSQL 18 server, [pnpm](https://pnpm.io), and Node.js (this repo is developed against Node 24; `migrations/run.ts` runs as plain TypeScript via Node's built-in type stripping, so an older Node may not run it).

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create the two databases the app uses — one for the app, one for the test suite:

   ```bash
   createdb contributor_registry
   createdb contributor_registry_test
   ```

3. Copy the environment template and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   `.env.local` is gitignored. See [Environment variables](#environment-variables) for what each entry needs; the OAuth credentials come from [Registering the OAuth applications](#registering-the-oauth-applications).

4. Apply the schema to both databases. `migrations/run.ts` reads `DATABASE_URL` from the shell environment rather than from an env file, so export each file's variables first:

   ```bash
   set -a; source .env.local; set +a; pnpm migrate
   set -a; source .env.test; set +a; pnpm migrate
   ```

   (`pnpm dev` and `pnpm test` don't need this step done for them separately — Next.js loads `.env.local` itself, and `tests/setup.ts` loads `.env.test` itself. Only the schema has to be applied to each database up front.)

5. Start the dev server:

   ```bash
   pnpm dev
   ```

   The app is at [http://localhost:3000](http://localhost:3000).

### Testing

```bash
pnpm test        # Vitest suite
pnpm typecheck   # tsc --noEmit
```

The test suite runs against `contributor_registry_test`, using the credentials already committed in `.env.test`, and expects the schema already applied by step 4 above.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_PASSWORD` | Encrypts the `iron-session` cookie; at least 32 characters (`openssl rand -base64 32`) |
| `APP_URL` | This environment's own origin — must match what's registered with each OAuth provider below |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | From the GitHub OAuth App |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | From the Discord application |
| `TELEGRAM_CLIENT_ID`, `TELEGRAM_CLIENT_SECRET` | From the Telegram bot |

All nine are required, not just for running the app: `src/lib/env.ts` validates the whole environment at import, and `next build` imports every route module while collecting page data, so `pnpm build` fails before it reaches any provider if even one variable is unset. Placeholder values satisfy this — the build never contacts a provider.

## Registering the OAuth applications

Each redirect URI must match the app's `APP_URL` exactly, so **every environment (local, staging, production) needs its own registration at all three providers** — a local run and a deployed one cannot share credentials.

### GitHub

At [github.com/settings/developers](https://github.com/settings/developers) → New OAuth App:

- Homepage URL: this environment's `APP_URL`
- Authorization callback URL: `{APP_URL}/auth/github/callback`

Put the generated client ID and secret into `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

[GitHub's documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) states that "OAuth apps cannot have multiple callback URLs, unlike GitHub Apps" — one more reason local and production need separate apps.

### Discord

At [discord.com/developers/applications](https://discord.com/developers/applications) → New Application → OAuth2 → add redirect `{APP_URL}/auth/discord/callback`.

Put the client ID and secret into `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`.

### Telegram

Via [@BotFather](https://t.me/botfather): `/newbot` in its regular chat to create the bot, then open BotFather's Mini App (not the chat commands) for Bot Settings → Web Login → add `{APP_URL}/auth/telegram/callback` as an allowed URL.

Put the bot's client ID and secret into `TELEGRAM_CLIENT_ID` / `TELEGRAM_CLIENT_SECRET`.

## Reading the data

There is no admin UI. Query Postgres directly:

```bash
psql "$DATABASE_URL" \
  -c "SELECT github_login, name, telegram_username, telegram_phone, discord_username, email, company FROM contributors"
```

A row exists from the moment someone signs in with GitHub, before they've typed anything, so `name` and `email` being null doesn't mean the row is broken — it means that contributor hasn't filled the form in yet, or signed in once and never came back. There's no column to tell those two cases apart directly; the reading convention is that **an entry counts as filled in when `name IS NOT NULL`**.

## Deployment

The application is a Next.js server backed by Postgres — portable to any host that provides both. A container image and a chosen hosting target are not set up yet. Whatever runs it will need its own OAuth registrations for its domain, following [Registering the OAuth applications](#registering-the-oauth-applications) above.
