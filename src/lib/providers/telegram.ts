import * as client from 'openid-client'
import { z } from 'zod'
import { env } from '@/lib/env'
import type { AuthRequest, Identity, Provider } from '@/lib/providers/types'

const claimsSchema = z.object({
  sub: z.string().min(1),
  preferred_username: z.string().min(1).optional(),
  phone_number: z.string().min(1).optional(),
})

/**
 * A Telegram account need not have an @username, so the phone number — asked
 * for only on a second pass, with the user's consent — stands in as the
 * identifier. When a username exists the phone is discarded.
 */
export function toIdentity(claims: unknown): Identity {
  const parsed = claimsSchema.parse(claims)
  if (parsed.preferred_username) {
    return { providerId: parsed.sub, username: parsed.preferred_username }
  }
  if (parsed.phone_number) {
    return { providerId: parsed.sub, phone: parsed.phone_number }
  }
  return { providerId: parsed.sub }
}

let cached: Promise<client.Configuration> | undefined

/**
 * `??=` alone would memoise a rejected promise forever — a rejection is not
 * nullish, so a transient discovery failure would wedge Telegram linking for
 * the process's whole lifetime. Instead: assign the in-flight promise
 * synchronously (so concurrent callers still share one discovery request),
 * then clear the cache on rejection — but only if nobody has since started a
 * newer attempt — so a later call can retry instead of replaying the same
 * failure.
 */
function configuration(): Promise<client.Configuration> {
  if (!cached) {
    const attempt = client.discovery(
      new URL('https://oauth.telegram.org'),
      env.TELEGRAM_CLIENT_ID,
      env.TELEGRAM_CLIENT_SECRET,
    )
    attempt.catch(() => {
      if (cached === attempt) cached = undefined
    })
    cached = attempt
  }
  return cached
}

export const telegram: Provider = {
  name: 'telegram',

  async authRequest(redirectUri: string, variant?: 'phone'): Promise<AuthRequest> {
    const config = await configuration()
    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
    const state = client.randomState()

    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: variant === 'phone' ? 'openid phone' : 'openid profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    return { url, codeVerifier, state }
  },

  async callback(currentUrl, _redirectUri, codeVerifier, state): Promise<Identity> {
    const config = await configuration()
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
    })

    const claims = tokens.claims()
    if (!claims) throw new Error('Telegram returned no id_token')

    return toIdentity(claims)
  },
}
