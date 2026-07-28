import { expect, test, vi } from 'vitest'
import { discord } from '@/lib/providers/discord'

test('sends the registered redirect_uri, not one derived from a proxied request URL', async () => {
  const registeredRedirectUri = 'https://sas-titles-warranty-translator.trycloudflare.com/auth/discord/callback'
  let tokenRequestBody: URLSearchParams | undefined

  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)

    if (url.startsWith('https://discord.com/api/oauth2/token')) {
      tokenRequestBody = new URLSearchParams(init?.body as string)
      return new Response(JSON.stringify({ access_token: 'discord_test', token_type: 'bearer' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url.startsWith('https://discord.com/api/users/@me')) {
      return new Response(JSON.stringify({ id: '80351110224678912', username: 'nelly' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    throw new Error(`unexpected request: ${url}`)
  })

  vi.stubGlobal('fetch', fetchMock)

  const request = await discord.authRequest(registeredRedirectUri)
  // This mimics what Next.js sees inside the Cloudflare tunnel: a different
  // scheme and host than the one registered with Discord.
  const callbackUrl = new URL(`http://localhost:3000/auth/discord/callback?code=abc123&state=${request.state}`)

  const identity = await discord.callback(callbackUrl, registeredRedirectUri, request.codeVerifier, request.state)

  expect(identity).toEqual({ providerId: '80351110224678912', username: 'nelly' })
  expect(tokenRequestBody?.get('redirect_uri')).toBe(registeredRedirectUri)

  vi.unstubAllGlobals()
})
