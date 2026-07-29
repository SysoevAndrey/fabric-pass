import type { ProviderName } from '@/lib/providers/types'

/**
 * A one-shot notice from an OAuth redirect, carried as a query parameter
 * rather than in the session. `session.error` used to hold this, but a
 * Server Component cannot clear a cookie during render, so a stale banner
 * would persist across every later visit until an unrelated success cleared
 * it. A query parameter disappears on the next navigation for free, which is
 * exactly the one-shot lifetime this notice needs.
 *
 * The code is a fixed, closed set chosen only by callback/route.ts — never
 * free text — so nothing reaches page.tsx from the URL except a lookup key.
 */
export type NoticeCode =
  | 'expired'
  | 'link-failed'
  | 'telegram-no-contact'
  | 'already-linked'
  | 'identity-changed'
  | 'reauth-required'

function isNoticeCode(value: string): value is NoticeCode {
  return (
    value === 'expired' ||
    value === 'link-failed' ||
    value === 'telegram-no-contact' ||
    value === 'already-linked' ||
    value === 'identity-changed' ||
    value === 'reauth-required'
  )
}

/** Builds the redirect target that carries a one-shot notice to `page.tsx`. */
export function withNotice(base: URL, code: NoticeCode, provider?: ProviderName): URL {
  const url = new URL(base)
  url.searchParams.set('notice', code)
  if (provider) url.searchParams.set('provider', provider)
  return url
}

/**
 * The inverse of `withNotice`: turns the query parameters `page.tsx` reads
 * back into the same contributor-facing message the callback route would
 * have shown, or `undefined` if there is nothing to show (including an
 * unrecognized or tampered code, which fails safe by showing nothing).
 */
export function noticeMessage(
  rawCode: string | string[] | undefined,
  rawProvider: string | string[] | undefined,
): string | undefined {
  const code = typeof rawCode === 'string' ? rawCode : undefined
  const provider = typeof rawProvider === 'string' ? rawProvider : undefined
  if (!code || !isNoticeCode(code)) return undefined

  switch (code) {
    case 'expired':
      return 'That sign-in link has expired. Please try again.'
    case 'link-failed':
      return provider ? `Linking ${provider} did not complete. Please try again.` : undefined
    case 'telegram-no-contact':
      return 'Your Telegram account has no username, and no phone number was shared, so it could not be linked.'
    case 'already-linked':
      // Links now persist the instant a callback returns, rather than at a
      // form submit, so a unique-constraint conflict from lib/contributors's
      // linkProvider has no form action to surface through — this is its
      // only path to the contributor.
      return provider
        ? `That ${provider} account is already linked to another contributor.`
        : 'That account is already linked to another contributor.'
    case 'identity-changed':
      // Discord/Telegram transactions are bound to the GitHub identity that
      // started them (see session.ts). A mismatch here means someone signed
      // in as a different GitHub account in the same browser before this
      // callback landed — retrying under the account that's signed in now
      // works fine, it just has to be started over.
      return provider
        ? `You signed in as a different GitHub account while linking ${provider}. Please start the ${provider} link again.`
        : 'You signed in as a different GitHub account partway through. Please try again.'
    case 'reauth-required':
      // The session cookie named a contributor row that no longer exists —
      // retrying the same action can never succeed, only signing in again can.
      return 'Your session no longer matches a saved contributor. Please sign in with GitHub again.'
  }
}
