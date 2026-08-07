import { env } from '@/lib/env'

// DigitalOcean blocks all outbound SMTP-family ports on this droplet (25,
// 465, 587, and even the commonly-unblocked 2525), confirmed by direct
// connectivity tests — so this sends over Resend's HTTPS API instead of SMTP.
// Sends from the root domain, not a dedicated subdomain — Resend rejects a
// send from a domain it hasn't verified, and only cfabric.org itself is
// verified there currently.
const FROM_ADDRESS = env.RESEND_FROM_ADDRESS ?? 'no-reply@cfabric.org'

export const EMAIL_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Shared send path for every email this app sends — never throws. A
 * transient email-provider failure, or no Resend key configured at all
 * (local dev, or production before it's set up), must never block whatever
 * database write already happened before the caller decided to send —
 * every caller here treats email as a best-effort notification, not a
 * transactional step.
 */
async function send(to: string, subject: string, text: string, html: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn(`Resend not configured — would have sent "${subject}" to ${to}`)
    return
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: `Constructor Fabric Pass <${FROM_ADDRESS}>`, to, subject, text, html }),
    })
    if (!response.ok) {
      console.error(`failed to send "${subject}" to ${to}: Resend responded ${response.status} ${await response.text()}`)
    }
  } catch (error) {
    console.error(`failed to send "${subject}" to ${to}:`, error)
  }
}

/**
 * Never throws (see send() above). A transient email-provider failure — or,
 * with no Resend key configured at all (local dev, or production before
 * it's set up) — must never block saving the contributor's own typed email:
 * the confirmation token is already persisted by the caller before this
 * runs, and the Send/Resend button (see contributors.ts#resendConfirmationEmail)
 * exists precisely to recover from a failed or skipped send.
 */
export async function sendConfirmationEmail(to: string, token: string): Promise<void> {
  const confirmUrl = `${env.APP_URL}/confirm-email?token=${token}`
  await send(
    to,
    'Confirm your email — Constructor Fabric Pass',
    `Confirm your email for Constructor Fabric Pass by visiting the link below within 24 hours:\n\n${confirmUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    `<p>Confirm your email for Constructor Fabric Pass by clicking the link below. This link expires in 24 hours.</p><p><a href="${confirmUrl}">${confirmUrl}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
  )
}

/**
 * IDEA-019 — sent alongside the in-app status shown on the track's own page
 * (see tracks/[slug]/page.tsx), not instead of it; email is a convenience
 * for a contributor who isn't looking at the page right when a Track Admin
 * decides. Never throws (see send() above) — the decision itself
 * (track-members.ts#decideJoinRequest) has already been persisted by the
 * time this is called, and must not be undone by an email provider hiccup.
 */
export async function sendTrackDecisionEmail(to: string, trackName: string, decision: 'approved' | 'rejected'): Promise<void> {
  const trackUrl = `${env.APP_URL}/tracks`
  const verb = decision === 'approved' ? 'accepted' : 'declined'
  await send(
    to,
    `Your request to join ${trackName} was ${verb} — Constructor Fabric Pass`,
    `Your request to join the ${trackName} track was ${verb}.\n\n${trackUrl}`,
    `<p>Your request to join the <strong>${trackName}</strong> track was ${verb}.</p><p><a href="${trackUrl}">${trackUrl}</a></p>`,
  )
}
