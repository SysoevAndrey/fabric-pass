import { beforeEach, expect, test, vi } from 'vitest'

// save() is a server action: it reads the session via getSession() and talks
// to Postgres via findByGithubId/upsert. Neither is available in a unit
// test, so both are replaced with in-memory doubles — the same seam used in
// tests/auth-callback-github-guard.test.ts for the callback route.
const { fakeSession, contributorsState } = vi.hoisted(() => ({
  fakeSession: {
    github: { id: '1001', login: 'octocat' } as { id: string; login: string } | undefined,
    pending: undefined as
      | { telegram?: { providerId: string; username?: string; phone?: string }; discord?: { providerId: string; username?: string } }
      | undefined,
    error: undefined as string | undefined,
    save: async () => {},
  },
  contributorsState: {
    existing: null as null | {
      telegramId?: string
      telegramUsername?: string
      telegramPhone?: string
      discordId?: string
      discordUsername?: string
    },
    // Controls what the mocked upsert() does on the next call.
    upsertOutcome: 'resolve' as 'resolve' | 'conflict-telegram' | 'conflict-discord' | 'db-error',
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

vi.mock('@/lib/session', () => ({
  getSession: async () => fakeSession,
}))

vi.mock('@/lib/contributors', async () => {
  const actual = await vi.importActual<typeof import('@/lib/contributors')>('@/lib/contributors')
  return {
    ...actual,
    findByGithubId: async () => contributorsState.existing,
    upsert: async () => {
      if (contributorsState.upsertOutcome === 'conflict-telegram') throw new actual.AccountAlreadyLinkedError('telegram')
      if (contributorsState.upsertOutcome === 'conflict-discord') throw new actual.AccountAlreadyLinkedError('discord')
      if (contributorsState.upsertOutcome === 'db-error') throw new Error('connection refused')
      return {
        id: '1',
        githubId: '1001',
        githubLogin: 'octocat',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    },
  }
})

const { save } = await import('./actions.ts')

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

beforeEach(() => {
  fakeSession.github = { id: '1001', login: 'octocat' }
  fakeSession.pending = undefined
  fakeSession.error = undefined
  contributorsState.existing = null
  contributorsState.upsertOutcome = 'resolve'
})

// Finding 1: a failed save must hand back what the contributor typed, for
// every failure kind, so the form can re-seed its (uncontrolled) fields
// before React's post-action form reset lands on stale/blank defaults.

test('a validation failure returns the submitted values', async () => {
  const data = form({ firstName: 'Ada', lastName: 'Lovelace', email: 'not-an-email', company: 'Ada Co' })

  const result = await save({ ok: false }, data)

  expect(result.ok).toBe(false)
  expect(result.values).toEqual({ firstName: 'Ada', lastName: 'Lovelace', email: 'not-an-email', company: 'Ada Co' })
})

test('an already-linked conflict returns the submitted values', async () => {
  contributorsState.upsertOutcome = 'conflict-telegram'
  fakeSession.pending = { telegram: { providerId: '999', username: 'stranger' } }
  const data = form({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' })

  const result = await save({ ok: false }, data)

  expect(result.ok).toBe(false)
  expect(result.values).toEqual({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: '' })
})

test('a database outage returns the submitted values', async () => {
  contributorsState.upsertOutcome = 'db-error'
  const data = form({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Analytical Engines' })

  const result = await save({ ok: false }, data)

  expect(result.ok).toBe(false)
  expect(result.values).toEqual({
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    company: 'Analytical Engines',
  })
})

// Finding 2: an already-linked-elsewhere conflict must only clear the
// provider that actually conflicted — any other pending link is untouched,
// so the contributor doesn't lose an unrelated, valid link and isn't stuck
// resubmitting a stranger's identity forever.

test('a telegram conflict clears only telegram from pending, leaving discord untouched', async () => {
  contributorsState.upsertOutcome = 'conflict-telegram'
  fakeSession.pending = {
    telegram: { providerId: '999', username: 'stranger' },
    discord: { providerId: '555', username: 'ada-discord' },
  }
  const data = form({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' })

  await save({ ok: false }, data)

  expect(fakeSession.pending?.telegram).toBeUndefined()
  expect(fakeSession.pending?.discord).toEqual({ providerId: '555', username: 'ada-discord' })
})

test('a discord conflict clears only discord from pending, leaving telegram untouched', async () => {
  contributorsState.upsertOutcome = 'conflict-discord'
  fakeSession.pending = {
    telegram: { providerId: '111', username: 'ada-telegram' },
    discord: { providerId: '999', username: 'stranger' },
  }
  const data = form({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' })

  await save({ ok: false }, data)

  expect(fakeSession.pending?.discord).toBeUndefined()
  expect(fakeSession.pending?.telegram).toEqual({ providerId: '111', username: 'ada-telegram' })
})

// Finding 3: a successful save must clear a stale session.error alongside
// pending, so an earlier failed link attempt doesn't reappear as an error
// banner after an unrelated, successful save.

test('a successful save clears a stale session error', async () => {
  fakeSession.error = 'Linking discord did not complete. Please try again.'
  const data = form({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' })

  const result = await save({ ok: false }, data)

  expect(result.ok).toBe(true)
  expect(fakeSession.error).toBeUndefined()
})
