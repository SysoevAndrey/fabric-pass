/**
 * The four mandatory fields — Full Name, Email, Company, and Discord —
 * checked the same way everywhere a contributor's profile is judged
 * complete: contributors.ts's isProfileComplete, over a stored row, and
 * form.tsx's Save gate, over a form's live draft values (via
 * missingMandatoryFields below). One rule, one place, so the two readings
 * of "complete" can't drift apart — including Main's redirect and the
 * post-sign-in landing page, both of which key off the same rule.
 *
 * Discord is checked via `discordUsername` rather than `discordId`: it's
 * the field contributors.ts's resolveProviderLabels already treats as "is
 * Discord linked" (hasOwnDiscord), and it's what form.tsx has on hand
 * client-side (discordLabel) — there is no raw discordId in the browser.
 *
 * Client-safe (no @/lib/db import): form.tsx ('use client') imports
 * missingMandatoryFields directly. form-schema.ts's validateField pulls in
 * @/lib/contributors (and, through it, `pg`) for isDetailField — a chain
 * that must never reach the browser bundle — so this rule can't live there.
 */
export function missingMandatoryFields(values: {
  name?: string
  email?: string
  company?: string
  discordUsername?: string
}): string[] {
  const missing: string[] = []
  if (!values.name?.trim()) missing.push('Full Name')
  if (!values.email?.trim()) missing.push('Email')
  if (!values.company?.trim()) missing.push('Company')
  if (!values.discordUsername?.trim()) missing.push('Discord')
  return missing
}

/** The boolean reading of missingMandatoryFields above, over a stored row
 * rather than a form's live draft — see contributors.ts's isProfileComplete. */
export function isProfileComplete(values: {
  name?: string
  email?: string
  company?: string
  discordUsername?: string
}): boolean {
  return missingMandatoryFields(values).length === 0
}
