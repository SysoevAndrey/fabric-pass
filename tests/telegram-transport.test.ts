import { beforeEach, expect, test, vi } from 'vitest'

// Telegram's `configuration()` is built from `client.discovery()`, an async
// call to a real network endpoint — unlike GitHub and Discord, which build a
// `Configuration` by hand. To drive a full round trip without hitting the
// real oauth.telegram.org, only `discovery` is replaced (returning a real,
// hand-built `Configuration` pointed at a fake token endpoint); every other
// export — `Configuration`, `customFetch`, `authorizationCodeGrant`,
// `buildAuthorizationUrl`, PKCE helpers — stays the real implementation, so
// this test exercises the same code path production does.
vi.mock('openid-client', async () => {
  const actual = await vi.importActual<typeof import('openid-client')>('openid-client')
  const config = new actual.Configuration(
    {
      issuer: 'https://telegram-test.local',
      authorization_endpoint: 'https://telegram-test.local/auth',
      token_endpoint: 'https://telegram-test.local/token',
    },
    'test-telegram-client-id',
    'test-telegram-client-secret',
  )
  return { ...actual, discovery: async () => config }
})

beforeEach(() => {
  vi.resetModules()
})

test('sends the registered redirect_uri, not one derived from a proxied request URL', async () => {
  const registeredRedirectUri = 'https://sas-titles-warranty-translator.trycloudflare.com/auth/telegram/callback'
  let tokenRequestBody: URLSearchParams | undefined

  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)

    if (url.startsWith('https://telegram-test.local/token')) {
      tokenRequestBody = new URLSearchParams(init?.body as string)
      // No id_token in the response: this test only cares about the token
      // *request*, not claim validation, which needs a real signed JWT and
      // JWKS that are out of scope here.
      return new Response(JSON.stringify({ access_token: 'tg_test', token_type: 'bearer' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    throw new Error(`unexpected request: ${url}`)
  })

  vi.stubGlobal('fetch', fetchMock)

  const { telegram } = await import('@/lib/providers/telegram')

  const request = await telegram.authRequest(registeredRedirectUri)
  // This mimics what Next.js sees inside the Cloudflare tunnel: a different
  // scheme and host than the one registered with Telegram.
  const callbackUrl = new URL(`http://localhost:3000/auth/telegram/callback?code=abc123&state=${request.state}`)

  await expect(
    telegram.callback(callbackUrl, registeredRedirectUri, request.codeVerifier, request.state),
  ).rejects.toThrow('Telegram returned no id_token')

  expect(tokenRequestBody?.get('redirect_uri')).toBe(registeredRedirectUri)

  vi.unstubAllGlobals()
})
