import nodemailer from 'nodemailer'
import { env } from '@/lib/env'

// Sent as whichever mailbox SMTP_USER authenticates as — most providers
// (this one included: name.com's cPanel-hosted mail) reject or flag a From
// address that doesn't match the authenticated account, so this is derived
// rather than a separately-hardcoded address that could drift out of sync
// with it. Falls back to a placeholder only because the module has to
// import cleanly with no SMTP configured at all (see the transporter below,
// and lib/env.ts's SMTP_* being the one optional block of variables) — the
// fallback is never actually used to send anything.
const FROM_ADDRESS = env.SMTP_USER ?? 'no-reply@cfabric.org'

export const EMAIL_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: (env.SMTP_PORT ?? 587) === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    })
  : null

/**
 * Never throws. A transient email-provider failure — or, with no SMTP
 * configured at all (local dev, or production before it's set up) — must
 * never block saving the contributor's own typed email: the confirmation
 * token is already persisted by the caller before this runs, and "resend"
 * (see contributors.ts#resendConfirmationEmail) exists precisely to recover
 * from a failed or skipped send.
 */
export async function sendConfirmationEmail(to: string, token: string): Promise<void> {
  const confirmUrl = `${env.APP_URL}/confirm-email?token=${token}`

  if (!transporter) {
    console.warn(`SMTP not configured — would have sent a confirmation email to ${to}: ${confirmUrl}`)
    return
  }

  try {
    await transporter.sendMail({
      from: `Constructor Fabric Pass <${FROM_ADDRESS}>`,
      to,
      subject: 'Confirm your email — Constructor Fabric Pass',
      text: `Confirm your email for Constructor Fabric Pass by visiting the link below within 24 hours:\n\n${confirmUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
      html: `<p>Confirm your email for Constructor Fabric Pass by clicking the link below. This link expires in 24 hours.</p><p><a href="${confirmUrl}">${confirmUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
    })
  } catch (error) {
    console.error(`failed to send confirmation email to ${to}:`, error)
  }
}
