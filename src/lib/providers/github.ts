import * as client from 'openid-client'
import { z } from 'zod'
import { env } from '@/lib/env'
import type { AuthRequest, Identity, Provider } from '@/lib/providers/types'

const profileSchema = z.object({
  id: z.number(),
  login: z.string().min(1),
})

export function toIdentity(profile: unknown): Identity {
  const parsed = profileSchema.parse(profile)
  return { providerId: String(parsed.id), username: parsed.login }
}

/**
 * GitHub answers the token endpoint with form-encoded data unless the request
 * asks for JSON, so every request from this client carries the header.
 */
const jsonFetch: client.CustomFetch = (url, options) => {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  return fetch(url, { ...options, headers } as RequestInit)
}

function configuration(): client.Configuration {
  const config = new client.Configuration(
    {
      issuer: 'https://github.com',
      authorization_endpoint: 'https://github.com/login/oauth/authorize',
      token_endpoint: 'https://github.com/login/oauth/access_token',
    },
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
  )
  config[client.customFetch] = jsonFetch
  return config
}

export const github: Provider = {
  name: 'github',

  async authRequest(redirectUri: string): Promise<AuthRequest> {
    const config = configuration()
    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
    const state = client.randomState()

    // No scope: an empty scope already grants read access to the public
    // profile, which is where `login` lives. Anything more would be surplus.
    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    return { url, codeVerifier, state }
  },

  async callback(currentUrl, _redirectUri, codeVerifier, state): Promise<Identity> {
    const config = configuration()
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
    })

    const response = await client.fetchProtectedResource(
      config,
      tokens.access_token,
      new URL('https://api.github.com/user'),
      'GET',
    )

    return toIdentity(await response.json())
  },
}
