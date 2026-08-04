import { beforeEach, expect, test, vi } from 'vitest'

// auth-linkedin-configuration.test.ts covers the unconfigured 404 paths for
// both LinkedIn routes, but nothing exercises GET /auth/linkedin once
// LinkedIn *is* configured — the SUCCESS path, same as this app's other
// providers get from auth-oauth-concurrent-transactions.test.ts. Mirrors that
// file's approach of mocking '@/lib/session' and '@/lib/providers' directly:
// a genuinely configured LinkedIn provider would reach out to LinkedIn's own
// OIDC discovery endpoint, which a unit test has no business doing.
const { fakeSession, authRequestResult } = vi.hoisted(() => ({
  fakeSession: {
    oauth: undefined as
      | Partial<
          Record<
            'github' | 'discord' | 'telegram' | 'linkedin',
            { codeVerifier: string; state: string; variant?: 'phone'; githubId?: string }
          >
        >
      | undefined,
    github: undefined as { id: string; login: string } | undefined,
    save: async () => {},
  },
  authRequestResult: {
    linkedin: {
      url: new URL('https://www.linkedin.com/oauth/v2/authorization?mock=1'),
      codeVerifier: 'linkedin-verifier',
      state: 'linkedin-state',
    },
  },
}))

vi.mock('@/lib/session', () => ({
  getSession: async () => fakeSession,
}))

vi.mock('@/lib/providers', () => ({
  isProviderName: (value: string) =>
    value === 'github' || value === 'discord' || value === 'telegram' || value === 'linkedin',
  providers: {
    linkedin: {
      name: 'linkedin',
      authRequest: async (_redirectUri: string) => authRequestResult.linkedin,
      callback: async () => {
        throw new Error('not used in this test')
      },
    },
  },
}))

const { GET: startGET } = await import('@/app/auth/[provider]/route')

beforeEach(() => {
  fakeSession.oauth = undefined
  // LinkedIn linking is only reachable once signed in — the page only offers
  // its button in the signed-in state — so this starts from an
  // already-signed-in session, same as the real flow would.
  fakeSession.github = { id: '1001', login: 'octocat' }
})

test('GET /auth/linkedin writes session.oauth.linkedin and redirects to the provider URL when configured', async () => {
  const response = await startGET(new Request('http://localhost:3000/auth/linkedin'), {
    params: Promise.resolve({ provider: 'linkedin' }),
  })

  expect(response.headers.get('location')).toBe(authRequestResult.linkedin.url.toString())
  expect(fakeSession.oauth?.linkedin).toEqual({
    codeVerifier: 'linkedin-verifier',
    state: 'linkedin-state',
    variant: undefined,
    githubId: '1001',
  })
})
