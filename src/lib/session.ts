import { getIronSession, type IronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import type { ProviderName } from '@/lib/providers/types'

/** One provider's in-flight authorization request. */
export interface OAuthTransaction {
  codeVerifier: string
  state: string
  variant?: 'phone'
  /**
   * The GitHub identity that was signed in when this transaction started —
   * absent for the github flow itself, which has none yet to record. Discord
   * and Telegram links are reachable only from the signed-in state, so the
   * callback binds each transaction to this id and refuses to complete it
   * under a different one: without this, a link started as one contributor
   * but completed after a different one signs in (same browser, mid-flow)
   * would write into whichever row happens to be signed in when the
   * provider's callback lands, not the one that started the link.
   */
  githubId?: string
}

export interface SessionData {
  github?: { id: string; login: string }
  /**
   * In-flight authorization requests, keyed by provider. Each provider gets
   * its own slot so starting a second provider's flow (e.g. Discord while
   * Telegram's callback hasn't landed yet) cannot overwrite the first's PKCE
   * verifier and state — the two flows run concurrently in the same browser
   * session whenever a contributor starts one link before finishing another.
   */
  oauth?: Partial<Record<ProviderName, OAuthTransaction>>
}

// Five days: long enough that an active contributor filling in their
// profile over a few sessions doesn't get logged out mid-visit, short
// enough to bound how long a stolen cookie stays useful. iron-session's own
// default is 14 days, which reads as too long for a cookie that grants
// write access to someone's contributor row with no second factor behind
// it; this also sets the cookie's own max-age, since cookieOptions below
// doesn't set one explicitly.
const SESSION_TTL_SECONDS = 5 * 24 * 60 * 60

export const sessionOptions: SessionOptions = {
  password: env.SESSION_PASSWORD,
  cookieName: 'contributor_registry_session',
  ttl: SESSION_TTL_SECONDS,
  cookieOptions: {
    secure: env.APP_URL.startsWith('https://'),
    httpOnly: true,
    sameSite: 'lax',
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}
