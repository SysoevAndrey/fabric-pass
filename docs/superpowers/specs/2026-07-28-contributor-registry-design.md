# Contributor Registry — Design

**Date:** 2026-07-28
**Status:** Approved, ready for implementation planning

## Purpose

Collect a directory of the open-source project's contributors: who they are, and how to reach them across the three places the project lives — GitHub, Telegram, and Discord.

A contributor opens a link, signs in with GitHub, optionally links Telegram and Discord, and fills in their name, email, and company. The result is one row per contributor:

`first_name`, `last_name`, `github`, `telegram`, `discord`, `email`, `company`

## Scope

- Tens of contributors over the lifetime of the form. The link stays up indefinitely; people arrive one at a time.
- The registry is a directory, not a legal record. No CLA, no consent versioning, no audit trail.
- Records are editable by their owner: signing in again loads the existing record for correction.

### Non-goals

- No admin UI. The registry is read directly from the database via SQL.
- No provider data beyond identity. No avatars, no provider-supplied names, no provider-supplied email addresses, no stored access or refresh tokens.

## Provider facts

All three providers now speak the same protocol — OAuth 2.0 authorization code flow with PKCE — so one client library covers all three.

| | Authorization | Token | Identity | Scope |
|---|---|---|---|---|
| GitHub | `https://github.com/login/oauth/authorize` | `https://github.com/login/oauth/access_token` | `https://api.github.com/user` | none |
| Discord | `https://discord.com/oauth2/authorize` | `https://discord.com/api/oauth2/token` | `/users/@me` | `identify` |
| Telegram | `https://oauth.telegram.org/auth` | `https://oauth.telegram.org/token` | `id_token` claims | `openid profile`, `phone` on fallback |

Notes that shape the implementation:

1. **Telegram is OpenID Connect.** It publishes discovery at `https://oauth.telegram.org/.well-known/openid-configuration` and a JWKS at `https://oauth.telegram.org/.well-known/jwks.json`. The username arrives as the `preferred_username` claim in a signed `id_token`, which must be cryptographically validated against the JWKS. The older iframe widget with `hash` verification is [legacy](https://core.telegram.org/widgets/login).
2. **A Telegram user may have no `@username`.** The `phone` scope returns a verified `phone_number` with explicit user consent, and serves as the fallback identifier.
3. **GitHub and Discord have no OIDC discovery.** Both are plain OAuth 2.0 and need manual endpoint configuration.
4. **GitHub requires no scope.** An empty scope grants read-only access to public profile information, which includes `login` — the minimum privilege that satisfies the requirement.
5. **GitHub's token endpoint needs `Accept: application/json`.** Without it the response is form-encoded.
6. **GitHub PKCE requires `S256`.** The `plain` challenge method is not supported.

## Architecture

A single Next.js application (App Router, TypeScript) backed by Postgres, using [`openid-client`](https://github.com/panva/openid-client) for all three providers.

Three modules with deliberate boundaries:

### `lib/providers/`

One file per provider, each exporting the same pair:

```
getAuthUrl(): URL
handleCallback(url): { providerId, username?, phone? }
```

Inside a provider file lives its `openid-client` configuration and the knowledge of where that provider keeps a username. Nothing provider-specific escapes the interface. Telegram uses `discovery()`; GitHub and Discord use a manually constructed `Configuration`. Adding a fourth provider means adding a file.

### `lib/session.ts`

A signed cookie holding the GitHub identity and any *pending* Telegram/Discord links. Nothing reaches the database until the form is submitted, so abandoned sign-ins leave no rows behind.

### `lib/contributors.ts`

The only module containing SQL: one read, one upsert.

### UI

One page, three states — signed out (GitHub button), signed in (the form), submitted (confirmation with a way back to edit).

## Data model

A single table, `contributors`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid primary key | |
| `github_id` | bigint unique not null | record key |
| `github_login` | text not null | |
| `telegram_id` | bigint unique | |
| `telegram_username` | text | |
| `telegram_phone` | text | fallback when no username exists |
| `discord_id` | text unique | snowflake, hence text |
| `discord_username` | text | |
| `first_name` | text not null | from the form |
| `last_name` | text not null | from the form |
| `email` | text not null | from the form |
| `company` | text | from the form |
| `created_at` | timestamptz not null | |
| `updated_at` | timestamptz not null | |

Both the numeric provider ID and the username are stored. Usernames on all three platforms can be changed by their owner at any time; the numeric ID cannot. Without the ID there is no way to tell later whether a renamed account is the same person. Both fields are identity only.

Unique constraints on `telegram_id` and `discord_id` prevent two contributors from claiming the same account.

## Concurrency

Writes are a single `INSERT ... ON CONFLICT (github_id) DO UPDATE`. There is no read-modify-write cycle, so concurrent submissions cannot race regardless of how many arrive at once. No transactions or locks are needed.

## Flows

### First visit

GitHub sign-in establishes the session. The form is empty; the Telegram and Discord link buttons are active. Links accumulate in the session cookie. Saving writes one row.

### Return visit

GitHub sign-in finds the record by `github_id`. The form is pre-filled and linked accounts are shown, each re-linkable.

### Telegram without a username

The first authorization requests `openid profile`. If no `preferred_username` comes back, a second authorization requests `phone`, with an explanation of why it is being asked. Only contributors without a username are ever asked for a phone number.

## Error handling

1. **User cancels an OAuth flow** — return to the form with a notice; entered data survives.
2. **`state` or PKCE mismatch** — reject and restart that link.
3. **Neither username nor phone consent** — the link is not recorded, and the reason is shown.
4. **Account already linked to another contributor** — a clear refusal, not a 500.
5. **Database unavailable** — 503, with form data preserved client-side.

## Testing

- **Unit** — the upsert, cookie signing and verification, and the username-or-phone resolution.
- **Integration** — provider callbacks against a local fake authorization server.
- **End-to-end** — one happy path with stubbed providers.

## Deployment prerequisites

The application is a Docker image plus a Postgres database, portable to any host that provides both. The deployment target is not yet chosen.

One thing gates everything: **the domain**. All three providers require the redirect URI to be registered in advance — a GitHub OAuth App, an application in the Discord developer portal, and a bot in BotFather under Bot Settings → Web Login. Local development needs its own separate registrations.
