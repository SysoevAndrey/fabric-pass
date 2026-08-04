import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// LinkedIn's `configuration()` is built from `client.discovery()`, an async
// call to a real network endpoint — same shape as telegram.ts. Only
// `discovery` is replaced (returning a real, hand-built `Configuration`
// pointed at a fake token endpoint); every other export — `Configuration`,
// `customFetch`, `authorizationCodeGrant`, `buildAuthorizationUrl`, PKCE
// helpers — stays the real implementation, so this test exercises the same
// code path production does.
vi.mock('openid-client', async () => {
  const actual = await vi.importActual<typeof import('openid-client')>('openid-client')
  const config = new actual.Configuration(
    {
      issuer: 'https://linkedin-test.local',
      authorization_endpoint: 'https://linkedin-test.local/auth',
      token_endpoint: 'https://linkedin-test.local/token',
    },
    'test-linkedin-client-id',
    'test-linkedin-client-secret',
  )
  return { ...actual, discovery: async () => config }
})

// .env.test deliberately leaves LinkedIn unconfigured (it's this app's only
// optional provider) — stubbed here so `linkedin.ts`'s configured-check
// passes and this test exercises the real transport, not that guard.
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('LINKEDIN_CLIENT_ID', 'test-linkedin-client-id')
  vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'test-linkedin-client-secret')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test('sends the registered redirect_uri, not one derived from a proxied request URL', async () => {
  const registeredRedirectUri = 'https://sas-titles-warranty-translator.trycloudflare.com/auth/linkedin/callback'
  let tokenRequestBody: URLSearchParams | undefined

  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)

    if (url.startsWith('https://linkedin-test.local/token')) {
      tokenRequestBody = new URLSearchParams(init?.body as string)
      // No id_token in the response: this test only cares about the token
      // *request*, not claim validation, which needs a real signed JWT and
      // JWKS that are out of scope here.
      return new Response(JSON.stringify({ access_token: 'li_test', token_type: 'bearer' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    throw new Error(`unexpected request: ${url}`)
  })

  vi.stubGlobal('fetch', fetchMock)

  const { linkedin } = await import('@/lib/providers/linkedin')

  const request = await linkedin.authRequest(registeredRedirectUri)
  // This mimics what Next.js sees inside the Cloudflare tunnel: a different
  // scheme and host than the one registered with LinkedIn.
  const callbackUrl = new URL(`http://localhost:3000/auth/linkedin/callback?code=abc123&state=${request.state}`)

  await expect(
    linkedin.callback(callbackUrl, registeredRedirectUri, request.codeVerifier, request.state),
  ).rejects.toThrow('LinkedIn returned no id_token')

  expect(tokenRequestBody?.get('redirect_uri')).toBe(registeredRedirectUri)

  vi.unstubAllGlobals()
})
