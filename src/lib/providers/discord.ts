import * as client from 'openid-client'
import { z } from 'zod'
import { env } from '@/lib/env'
import type { AuthRequest, Identity, Provider } from '@/lib/providers/types'

/**
 * Discord ids are snowflakes and already arrive as strings. `global_name` —
 * the display name shown across Discord's UI, distinct from `username` — is
 * already part of the `identify` scope's response; email is deliberately
 * left unparsed, since reading it would need the separate `email` scope.
 */
const profileSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  global_name: z.string().min(1).nullish(),
})

export function toIdentity(profile: unknown): Identity {
  const parsed = profileSchema.parse(profile)
  return { providerId: parsed.id, username: parsed.username, ...(parsed.global_name ? { name: parsed.global_name } : {}) }
}

/**
 * Corrects `redirect_uri` on the token exchange. `openid-client` derives that
 * parameter from `currentUrl` — the request URL as the app sees it, which
 * behind a reverse proxy or tunnel differs in scheme and/or host from the URL
 * actually registered with Discord. Discord's authorize endpoint accepts
 * subpaths of the registered URL, so the authorization step never catches
 * this; its token endpoint requires an exact match. Passing the registered
 * value as a `tokenEndpointParameters` argument does not survive either —
 * `openid-client` sets `redirect_uri` from the callback URL after merging any
 * additional parameters, silently overriding it. Rewriting the body here,
 * after that overwrite, is the only point that sticks (see `openid-client`'s
 * `customFetch` doc, "Correcting redirect_uri for Token Endpoint").
 */
function tokenFetch(registeredRedirectUri: string): client.CustomFetch {
  return (url, options) => {
    if (options.body instanceof URLSearchParams && options.body.get('grant_type') === 'authorization_code') {
      options.body.set('redirect_uri', registeredRedirectUri)
    }
    return fetch(url, options as RequestInit)
  }
}

function configuration(registeredRedirectUri: string): client.Configuration {
  const config = new client.Configuration(
    {
      issuer: 'https://discord.com',
      authorization_endpoint: 'https://discord.com/oauth2/authorize',
      token_endpoint: 'https://discord.com/api/oauth2/token',
    },
    env.DISCORD_CLIENT_ID,
    env.DISCORD_CLIENT_SECRET,
  )
  config[client.customFetch] = tokenFetch(registeredRedirectUri)
  return config
}

export const discord: Provider = {
  name: 'discord',

  async authRequest(redirectUri: string): Promise<AuthRequest> {
    const config = configuration(redirectUri)
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

  async callback(currentUrl, redirectUri, codeVerifier, state): Promise<Identity> {
    const config = configuration(redirectUri)
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
