import { getIronSession, type IronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import type { ProviderName } from '@/lib/providers/types'

/** One provider's in-flight authorization request. */
export interface OAuthTransaction {
  codeVerifier: string
  state: string
  variant?: 'phone'
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

export const sessionOptions: SessionOptions = {
  password: env.SESSION_PASSWORD,
  cookieName: 'contributor_registry_session',
  cookieOptions: {
    secure: env.APP_URL.startsWith('https://'),
    httpOnly: true,
    sameSite: 'lax',
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}
