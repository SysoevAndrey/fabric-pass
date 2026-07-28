import { beforeEach, expect, test, vi } from 'vitest'

// The callback route is a Next.js GET handler: it reads cookies via
// getSession() and calls out to a real provider over the network via
// providers[name].callback(). Neither is available in a unit test, so both
// are replaced with in-memory doubles — this is the seam that makes the
// username guard testable without a live request or a live GitHub call.
const { fakeSession } = vi.hoisted(() => ({
  fakeSession: {
    oauth: undefined as { provider: 'github'; codeVerifier: string; state: string; variant?: 'phone' } | undefined,
    github: undefined as { id: string; login: string } | undefined,
    pending: undefined as { telegram?: unknown; discord?: unknown } | undefined,
    error: undefined as string | undefined,
    save: async () => {},
  },
}))

vi.mock('@/lib/session', () => ({
  getSession: async () => fakeSession,
}))

vi.mock('@/lib/providers', () => ({
  isProviderName: (value: string) => value === 'github' || value === 'discord' || value === 'telegram',
  providers: {
    github: {
      name: 'github',
      authRequest: async () => {
        throw new Error('not used in this test')
      },
      // No username — the exact shape the guard must catch.
      callback: async () => ({ providerId: '583231' }),
    },
    discord: {
      name: 'discord',
      authRequest: async () => {
        throw new Error('not used in this test')
      },
      callback: async () => {
        throw new Error('not used in this test')
      },
    },
    telegram: {
      name: 'telegram',
      authRequest: async () => {
        throw new Error('not used in this test')
      },
      callback: async () => {
        throw new Error('not used in this test')
      },
    },
  },
}))

const { GET } = await import('@/app/auth/[provider]/callback/route')

beforeEach(() => {
  fakeSession.oauth = { provider: 'github', codeVerifier: 'verifier', state: 'state-123' }
  fakeSession.github = undefined
  fakeSession.pending = undefined
  fakeSession.error = undefined
})

test('a github identity with no username is refused, not written to the session', async () => {
  const request = new Request('http://localhost:3000/auth/github/callback?code=abc&state=state-123')
  const context = { params: Promise.resolve({ provider: 'github' }) }

  await GET(request, context)

  // The invariant the assertion relied on can't be seen by the guard's
  // caller, so a missing username must be refused the same way every other
  // provider failure already is — not written into a `string`-typed field.
  expect(fakeSession.github).toBeUndefined()
  expect(fakeSession.error).toBeDefined()
})
