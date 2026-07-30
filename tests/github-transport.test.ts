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

  expect(identity).toEqual({ providerId: '583231', username: 'octocat', email: 'secret@example.com' })
  // The profile carried an avatar; it doesn't survive the mapping. Email
  // does — GitHub's `/user` already returns it, public-profile visibility
  // permitting, with no extra scope requested (see providers/github.ts).
  expect(Object.keys(identity).sort()).toEqual(['email', 'providerId', 'username'])
  expect(calls.some((c) => c.startsWith('https://github.com/login/oauth/access_token'))).toBe(true)

  vi.unstubAllGlobals()
})

test('sends the registered redirect_uri, not one derived from a proxied request URL', async () => {
  const registeredRedirectUri = 'https://sas-titles-warranty-translator.trycloudflare.com/auth/github/callback'
  let tokenRequestBody: URLSearchParams | undefined

  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)

    if (url.startsWith('https://github.com/login/oauth/access_token')) {
      tokenRequestBody = new URLSearchParams(init?.body as string)
      return new Response(JSON.stringify({ access_token: 'gho_test', token_type: 'bearer' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url.startsWith('https://api.github.com/user')) {
      return new Response(JSON.stringify({ id: 583231, login: 'octocat' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    throw new Error(`unexpected request: ${url}`)
  })

  vi.stubGlobal('fetch', fetchMock)

  const request = await github.authRequest(registeredRedirectUri)
  // This mimics what Next.js sees inside the Cloudflare tunnel: a different
  // scheme and host than the one registered with GitHub.
  const callbackUrl = new URL(`http://localhost:3000/auth/github/callback?code=abc123&state=${request.state}`)

  await github.callback(callbackUrl, registeredRedirectUri, request.codeVerifier, request.state)

  expect(tokenRequestBody?.get('redirect_uri')).toBe(registeredRedirectUri)

  vi.unstubAllGlobals()
})

test('rejects a callback whose state does not match the one we stored', async () => {
  // `state` is the CSRF boundary: the callback URL's `state` query parameter
  // must match what the session stored from authRequest(), or the callback
  // must be refused before any token exchange happens. This proves our
  // wiring actually passes `expectedState` through to `openid-client` — not
  // `openid-client`'s own state-matching logic, which is out of scope.
  const fetchMock = vi.fn(async () => {
    throw new Error('must not reach the network: state must be rejected first')
  })
  vi.stubGlobal('fetch', fetchMock)

  const request = await github.authRequest('http://localhost:3000/auth/github/callback')
  const callbackUrl = new URL(
    `http://localhost:3000/auth/github/callback?code=abc123&state=not-the-state-we-stored`,
  )

  await expect(
    github.callback(callbackUrl, 'http://localhost:3000/auth/github/callback', request.codeVerifier, request.state),
  ).rejects.toThrow()
  expect(fetchMock).not.toHaveBeenCalled()

  vi.unstubAllGlobals()
})
