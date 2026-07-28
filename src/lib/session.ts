import { getIronSession, type IronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import type { Identity, ProviderName } from '@/lib/providers/types'

export interface SessionData {
  github?: { id: string; login: string }
  /** Links made in this session, held here until the form is submitted. */
  pending?: { telegram?: Identity; discord?: Identity }
  /** The in-flight authorization request. */
  oauth?: { provider: ProviderName; codeVerifier: string; state: string; variant?: 'phone' }
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
