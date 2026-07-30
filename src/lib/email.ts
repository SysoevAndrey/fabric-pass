import { env } from '@/lib/env'

// DigitalOcean blocks all outbound SMTP-family ports on this droplet (25,
// 465, 587, and even the commonly-unblocked 2525), confirmed by direct
// connectivity tests — so this sends over Resend's HTTPS API instead of SMTP.
// `send.cfabric.org` is Resend's dedicated sending subdomain (its own
// MX/SPF), kept separate from the root domain's existing mail setup.
const FROM_ADDRESS = env.RESEND_FROM_ADDRESS ?? 'no-reply@send.cfabric.org'

export const EMAIL_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Never throws. A transient email-provider failure — or, with no Resend key
 * configured at all (local dev, or production before it's set up) — must
 * never block saving the contributor's own typed email: the confirmation
 * token is already persisted by the caller before this runs, and the
 * Send/Resend button (see contributors.ts#resendConfirmationEmail) exists
 * precisely to recover from a failed or skipped send.
 */
export async function sendConfirmationEmail(to: string, token: string): Promise<void> {
  const confirmUrl = `${env.APP_URL}/confirm-email?token=${token}`

  if (!env.RESEND_API_KEY) {
    console.warn(`Resend not configured — would have sent a confirmation email to ${to}: ${confirmUrl}`)
    return
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Constructor Fabric Pass <${FROM_ADDRESS}>`,
        to,
        subject: 'Confirm your email — Constructor Fabric Pass',
        text: `Confirm your email for Constructor Fabric Pass by visiting the link below within 24 hours:\n\n${confirmUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
        html: `<p>Confirm your email for Constructor Fabric Pass by clicking the link below. This link expires in 24 hours.</p><p><a href="${confirmUrl}">${confirmUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
      }),
    })
    if (!response.ok) {
      console.error(`failed to send confirmation email to ${to}: Resend responded ${response.status} ${await response.text()}`)
    }
  } catch (error) {
    console.error(`failed to send confirmation email to ${to}:`, error)
  }
}
