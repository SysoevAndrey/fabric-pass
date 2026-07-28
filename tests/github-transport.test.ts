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
