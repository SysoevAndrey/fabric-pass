import { beforeEach, expect, test, vi } from 'vitest'

// The callback route is a Next.js GET handler: it reads cookies via
// getSession() and calls out to a real provider over the network via
// providers[name].callback(). Neither is available in a unit test, so both
// are replaced with in-memory doubles — this is the seam that makes the
// username guard testable without a live request or a live GitHub call.
const { fakeSession } = vi.hoisted(() => ({
  fakeSession: {
    oauth: undefined as
      | { provider: 'github' | 'discord' | 'telegram'; codeVerifier: string; state: string; variant?: 'phone' }
      | undefined,
    github: undefined as { id: string; login: string } | undefined,
    pending: undefined as { telegram?: unknown; discord?: unknown } | undefined,
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
})

test('a github identity with no username is refused, not written to the session', async () => {
  const request = new Request('http://localhost:3000/auth/github/callback?code=abc&state=state-123')
  const context = { params: Promise.resolve({ provider: 'github' }) }

  const response = await GET(request, context)

  // The invariant the assertion relied on can't be seen by the guard's
  // caller, so a missing username must be refused the same way every other
  // provider failure already is — not written into a `string`-typed field,
  // and surfaced as the same one-shot notice a provider callback error gets.
  expect(fakeSession.github).toBeUndefined()
  const location = response.headers.get('location')
  expect(location).toContain('notice=link-failed')
  expect(location).toContain('provider=github')
})

// The transaction guard is the CSRF/replay boundary for the whole callback:
// no session.oauth (a stale tab, a replay) and a transaction that names a
// different provider (an attacker or a mixed-up multi-tab flow) must both be
// refused before the callback ever calls out to the provider or touches
// session.github/session.pending.

test('a callback with no stored transaction at all is refused as expired', async () => {
  fakeSession.oauth = undefined
  const request = new Request('http://localhost:3000/auth/github/callback?code=abc&state=state-123')
  const context = { params: Promise.resolve({ provider: 'github' }) }

  const response = await GET(request, context)

  expect(fakeSession.oauth).toBeUndefined()
  expect(fakeSession.github).toBeUndefined()
  expect(fakeSession.pending).toBeUndefined()
  const location = response.headers.get('location')
  expect(location).toContain('notice=expired')
})

test('a stored transaction for a different provider is refused as expired', async () => {
  // The URL asks to complete a github callback, but the stored transaction
  // was for a discord authorization — provider must be checked, not just
  // presence of a transaction.
  fakeSession.oauth = { provider: 'discord', codeVerifier: 'verifier', state: 'state-123' }
  const request = new Request('http://localhost:3000/auth/github/callback?code=abc&state=state-123')
  const context = { params: Promise.resolve({ provider: 'github' }) }

  const response = await GET(request, context)

  expect(fakeSession.oauth).toBeUndefined()
  expect(fakeSession.github).toBeUndefined()
  expect(fakeSession.pending).toBeUndefined()
  const location = response.headers.get('location')
  expect(location).toContain('notice=expired')
})
