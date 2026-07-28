import * as client from 'openid-client'
import { z } from 'zod'
import { env } from '@/lib/env'
import type { AuthRequest, Identity, Provider } from '@/lib/providers/types'

// An empty string must be treated the same as an absent claim: it is
// unknown whether Telegram omits `preferred_username`/`phone_number` or
// sends `""` for an account with neither, since no OAuth application has
// been registered with Telegram yet to observe a real response. `.min(1)`
// alone would throw on `""` instead, which would abort `toIdentity` and skip
// the phone fallback entirely — the spec's headline edge case.
const emptyToUndefined = (value: string) => (value === '' ? undefined : value)
const claimsSchema = z.object({
  sub: z.string().min(1),
  preferred_username: z.string().transform(emptyToUndefined).optional(),
  phone_number: z.string().transform(emptyToUndefined).optional(),
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

/**
 * Corrects `redirect_uri` on the token exchange, same defect and same fix as
 * GitHub and Discord: `openid-client` derives that parameter from
 * `currentUrl` rather than the URL actually registered with Telegram, and a
 * `tokenEndpointParameters` override does not survive — the library
 * overwrites `redirect_uri` from the callback URL after merging additional
 * parameters. Rewriting the body here, after that overwrite, is the only
 * point that sticks (see `openid-client`'s `customFetch` doc, "Correcting
 * redirect_uri for Token Endpoint").
 */
function tokenFetch(registeredRedirectUri: string): client.CustomFetch {
  return (url, options) => {
    if (options.body instanceof URLSearchParams && options.body.get('grant_type') === 'authorization_code') {
      options.body.set('redirect_uri', registeredRedirectUri)
    }
    return fetch(url, options as RequestInit)
  }
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

  async callback(currentUrl, redirectUri, codeVerifier, state): Promise<Identity> {
    const config = await configuration()
    // `configuration()` is memoised across calls (see above), so the
    // customFetch override is applied here, right before use, rather than
    // baked into the cached instance at discovery time.
    config[client.customFetch] = tokenFetch(redirectUri)
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
    })

    const claims = tokens.claims()
    if (!claims) throw new Error('Telegram returned no id_token')

    return toIdentity(claims)
  },
}
