import * as client from 'openid-client'
import { z } from 'zod'
import { env } from '@/lib/env'
import type { AuthRequest, Identity, Provider } from '@/lib/providers/types'

/** Discord ids are snowflakes and already arrive as strings. */
const profileSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
})

export function toIdentity(profile: unknown): Identity {
  const parsed = profileSchema.parse(profile)
  return { providerId: parsed.id, username: parsed.username }
}

function configuration(): client.Configuration {
  return new client.Configuration(
    {
      issuer: 'https://discord.com',
      authorization_endpoint: 'https://discord.com/oauth2/authorize',
      token_endpoint: 'https://discord.com/api/oauth2/token',
    },
    env.DISCORD_CLIENT_ID,
    env.DISCORD_CLIENT_SECRET,
  )
}

export const discord: Provider = {
  name: 'discord',

  async authRequest(redirectUri: string): Promise<AuthRequest> {
    const config = configuration()
    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
    const state = client.randomState()

    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: 'identify',
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
      new URL('https://discord.com/api/users/@me'),
      'GET',
    )

    return toIdentity(await response.json())
  },
}
