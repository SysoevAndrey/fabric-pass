import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { confirmEmail } from '@/lib/contributors'
import { withNotice } from '@/app/auth/notice'

/** The link sent by lib/email.ts's sendConfirmationEmail. No session or
 * sign-in is required to reach this — the token itself is the credential,
 * exactly as it needs to be for a link clicked from an email client. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  const home = new URL('/', env.APP_URL)

  if (!token) return NextResponse.redirect(withNotice(home, 'invalid-confirmation-link'))

  const result = await confirmEmail(token)
  if (result === 'confirmed') return NextResponse.redirect(withNotice(home, 'email-confirmed'))
  if (result === 'expired') return NextResponse.redirect(withNotice(home, 'confirmation-expired'))
  return NextResponse.redirect(withNotice(home, 'invalid-confirmation-link'))
}
