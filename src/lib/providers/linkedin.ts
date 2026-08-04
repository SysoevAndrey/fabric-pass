import * as client from 'openid-client'
import { z } from 'zod'
import { env } from '@/lib/env'
import type { AuthRequest, Identity, Provider } from '@/lib/providers/types'

// LinkedIn's OIDC payload carries no username or vanity-URL claim — `name`
// is the only thing usable as a label (see contributors.ts, which stores it
// as `linkedin_name` with no counterpart `linkedin_username` column). `email`
// is deliberately not part of this schema at all: the `openid profile email`
// scope still asks for it, but nothing here reads or stores it.
const claimsSchema = z.object({
  sub: z.string().min(1),
  name: z.string().min(1).optional(),
})

export function toIdentity(claims: unknown): Identity {
  const parsed = claimsSchema.parse(claims)
  return { providerId: parsed.sub, ...(parsed.name ? { name: parsed.name } : {}) }
}

/**
 * Corrects `redirect_uri` on the token exchange, same defect and same fix as
 * every other provider here: `openid-client` derives that parameter from
 * `currentUrl` rather than the URL actually registered with LinkedIn, and a
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
 * nullish, so a transient discovery failure would wedge LinkedIn linking for
 * the process's whole lifetime. Instead: assign the in-flight promise
 * synchronously (so concurrent callers still share one discovery request),
 * then clear the cache on rejection — but only if nobody has since started a
 * newer attempt — so a later call can retry instead of replaying the same
 * failure. Same pattern as telegram.ts's `configuration`.
 *
 * The URL passed to `client.discovery` points directly at LinkedIn's
 * discovery document, at a non-default path (`/oauth/.well-known/...`
 * rather than a bare issuer root) — `openid-client` supports this, at the
 * cost of skipping its own `issuer` claim validation (see its `discovery`
 * doc's note on "a URL pointing directly to the Authorization Server's
 * discovery document").
 *
 * LinkedIn is the only provider this app ever calls with no credentials
 * configured at all — every route reachable from the UI only offers
 * LinkedIn once `lib/providers/index.ts` has already confirmed both are set
 * (see `isProviderConfigured`), so a `configuration()` call reaching this
 * guard is a broken invariant elsewhere, not a normal unconfigured state.
 */
function configuration(): Promise<client.Configuration> {
  if (!cached) {
    const clientId = env.LINKEDIN_CLIENT_ID
    const clientSecret = env.LINKEDIN_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error('linkedin: LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET are not configured')
    }
    const attempt = client.discovery(
      new URL('https://www.linkedin.com/oauth/.well-known/openid-configuration'),
      clientId,
      clientSecret,
    )
    attempt.catch(() => {
      if (cached === attempt) cached = undefined
    })
    cached = attempt
  }
  return cached
}

export const linkedin: Provider = {
  name: 'linkedin',

  async authRequest(redirectUri: string): Promise<AuthRequest> {
    const config = await configuration()
    const codeVerifier = client.randomPKCECodeVerifier()
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
    const state = client.randomState()

    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope: 'openid profile email',
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
    if (!claims) throw new Error('LinkedIn returned no id_token')

    return toIdentity(claims)
  },
}
