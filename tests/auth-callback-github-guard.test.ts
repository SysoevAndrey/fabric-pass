import { beforeEach, expect, test, vi } from 'vitest'

// The callback route is a Next.js GET handler: it reads cookies via
// getSession() and calls out to a real provider over the network via
// providers[name].callback(). Neither is available in a unit test, so both
// are replaced with in-memory doubles — this is the seam that makes the
// username guard testable without a live request or a live GitHub call.
const { fakeSession, githubCallbackResult } = vi.hoisted(() => ({
  fakeSession: {
    oauth: undefined as
      | Partial<
          Record<'github' | 'discord' | 'telegram', { codeVerifier: string; state: string; variant?: 'phone' }>
        >
      | undefined,
    github: undefined as { id: string; login: string } | undefined,
    pending: undefined as { telegram?: unknown; discord?: unknown } | undefined,
    save: async () => {},
  },
  // Mutable so individual tests can make the mocked github callback return a
  // full identity (for the identity-switch test) instead of the no-username
  // shape the guard test needs — set back to the default in beforeEach.
  githubCallbackResult: { current: { providerId: '583231' } as { providerId: string; username?: string } },
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
      callback: async () => githubCallbackResult.current,
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
  fakeSession.oauth = { github: { codeVerifier: 'verifier', state: 'state-123' } }
  fakeSession.github = undefined
  fakeSession.pending = undefined
  // No username — the exact shape the "no username" guard test needs. The
  // identity-switch test below overrides this to a full identity.
  githubCallbackResult.current = { providerId: '583231' }
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

test('signing in as a different github identity clears a pending link from the previous one', async () => {
  fakeSession.github = { id: 'old-id-111', login: 'old-login' }
  fakeSession.pending = { telegram: { providerId: '999', username: 'stranger' } }
  githubCallbackResult.current = { providerId: 'new-id-222', username: 'new-login' }

  const request = new Request('http://localhost:3000/auth/github/callback?code=abc&state=state-123')
  const context = { params: Promise.resolve({ provider: 'github' }) }

  await GET(request, context)

  expect(fakeSession.github).toEqual({ id: 'new-id-222', login: 'new-login' })
  expect(fakeSession.pending).toBeUndefined()
})

test('signing back in as the same github identity leaves a pending link untouched', async () => {
  fakeSession.github = { id: 'same-id-333', login: 'same-login' }
  fakeSession.pending = { telegram: { providerId: '999', username: 'ada' } }
  // Same providerId as session.github.id — not a switch.
  githubCallbackResult.current = { providerId: 'same-id-333', username: 'same-login' }

  const request = new Request('http://localhost:3000/auth/github/callback?code=abc&state=state-123')
  const context = { params: Promise.resolve({ provider: 'github' }) }

  await GET(request, context)

  expect(fakeSession.pending).toEqual({ telegram: { providerId: '999', username: 'ada' } })
})

test('a callback for a provider with no transaction of its own is refused as expired, even while another provider has one in flight', async () => {
  // The URL asks to complete a github callback, but only a discord
  // authorization is stored — each provider's transaction is keyed
  // separately, so github's own slot is simply absent here.
  fakeSession.oauth = { discord: { codeVerifier: 'verifier', state: 'state-123' } }
  const request = new Request('http://localhost:3000/auth/github/callback?code=abc&state=state-123')
  const context = { params: Promise.resolve({ provider: 'github' }) }

  const response = await GET(request, context)

  // The in-flight discord transaction must survive an unrelated, refused
  // github callback — refusing one provider must not clear another's slot.
  expect(fakeSession.oauth).toEqual({ discord: { codeVerifier: 'verifier', state: 'state-123' } })
  expect(fakeSession.github).toBeUndefined()
  expect(fakeSession.pending).toBeUndefined()
  const location = response.headers.get('location')
  expect(location).toContain('notice=expired')
})
