import { beforeEach, expect, test, vi } from 'vitest'

// saveField() is a server action: it reads the session via getSession() and
// writes via @/lib/contributors's saveField. Neither is available in a unit
// test, so both are replaced with in-memory doubles.
const { fakeSession, persisted } = vi.hoisted(() => ({
  fakeSession: {
    github: { id: '1001', login: 'octocat' } as { id: string; login: string } | undefined,
    save: async () => {},
  },
  // Records every call the mocked DB layer receives, and can be told to throw.
  persisted: {
    calls: [] as { githubId: string; field: string; value: string | undefined }[],
    shouldThrow: false,
  },
}))

vi.mock('@/lib/session', () => ({
  getSession: async () => fakeSession,
}))

vi.mock('@/lib/contributors', async () => {
  const actual = await vi.importActual<typeof import('@/lib/contributors')>('@/lib/contributors')
  return {
    ...actual,
    saveField: async (githubId: string, field: string, value: string | undefined) => {
      if (persisted.shouldThrow) throw new Error('connection refused')
      persisted.calls.push({ githubId, field, value })
    },
  }
})

const { saveField } = await import('./actions.ts')

beforeEach(() => {
  fakeSession.github = { id: '1001', login: 'octocat' }
  persisted.calls = []
  persisted.shouldThrow = false
})

test('refuses to save when nobody is signed in', async () => {
  fakeSession.github = undefined

  const result = await saveField('name', 'Ada Lovelace')

  expect(result).toEqual({ ok: false, message: 'Please sign in with GitHub first.' })
  expect(persisted.calls).toEqual([])
})

test('a valid name is persisted for the signed-in contributor', async () => {
  const result = await saveField('name', '  Ada Lovelace  ')

  expect(result).toEqual({ ok: true })
  expect(persisted.calls).toEqual([{ githubId: '1001', field: 'name', value: 'Ada Lovelace' }])
})

test('a malformed email is refused and never reaches the database', async () => {
  const result = await saveField('email', 'not-an-email')

  expect(result.ok).toBe(false)
  expect(result.message).toMatch(/email/i)
  expect(persisted.calls).toEqual([])
})

test('clearing a field to blank persists it as cleared', async () => {
  const result = await saveField('company', '   ')

  expect(result).toEqual({ ok: true })
  expect(persisted.calls).toEqual([{ githubId: '1001', field: 'company', value: undefined }])
})

test('a database outage is reported without leaking the underlying error', async () => {
  persisted.shouldThrow = true

  const result = await saveField('name', 'Ada Lovelace')

  expect(result.ok).toBe(false)
  expect(result.message).toBe('Could not save right now. Please try again in a moment.')
})
