import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { resendConfirmationEmail } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { withNotice } from '@/app/auth/notice'

/** Session-authenticated, unlike /confirm-email — this always resends *the
 * signed-in contributor's own* pending email, never one named by the
 * request, so there's no token or contributor id to trust from outside. */
export async function GET() {
  const session = await getSession()
  const home = new URL('/', env.APP_URL)

  if (!session.github) return NextResponse.redirect(withNotice(home, 'expired'))

  await resendConfirmationEmail(session.github.id)
  return NextResponse.redirect(withNotice(home, 'confirmation-resent'))
}
