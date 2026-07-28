import type { Identity } from '@/lib/providers/types'

export type TelegramOutcome =
  | { kind: 'link'; identity: Identity }
  | { kind: 'retry-with-phone' }
  | { kind: 'failed'; message: string }

/**
 * Telegram is asked for a phone only when the account turns out to have no
 * @username — so the first pass requests `profile`, and only a blank result
 * escalates to `phone`.
 */
export function resolveTelegramOutcome(identity: Identity, variant: 'phone' | undefined): TelegramOutcome {
  if (identity.username || identity.phone) return { kind: 'link', identity }
  if (variant !== 'phone') return { kind: 'retry-with-phone' }
  return {
    kind: 'failed',
    message: 'Your Telegram account has no username, and no phone number was shared, so it could not be linked.',
  }
}
