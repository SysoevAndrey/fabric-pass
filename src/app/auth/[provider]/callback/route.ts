import { inspect } from 'node:util'
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { isProviderName, providers } from '@/lib/providers'
import { getSession } from '@/lib/session'
import { withNotice } from '@/app/auth/notice'
import { resolveTelegramOutcome } from './outcome'

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await context.params
  if (!isProviderName(name)) return new NextResponse('Unknown provider', { status: 404 })

  const session = await getSession()
  const transaction = session.oauth?.[name]
  const home = new URL('/', env.APP_URL)

  // A callback with no matching transaction for *this* provider is a replay
  // or a stale tab. Providers are keyed independently, so a transaction
  // belonging to a different, still in-flight provider is simply absent here
  // — it is left alone, not cleared, since it may yet complete.
  if (!transaction) {
    return NextResponse.redirect(withNotice(home, 'expired'))
  }

  const redirectUri = `${env.APP_URL}/auth/${name}/callback`
  // Consume only this provider's own transaction — a completed link for one
  // provider must not wipe another provider's still in-flight one.
  session.oauth = { ...session.oauth, [name]: undefined }

  let identity
  try {
    identity = await providers[name].callback(
      new URL(request.url),
      redirectUri,
      transaction.codeVerifier,
      transaction.state,
    )
  } catch (error) {
    // Covers a cancelled authorization, a state or PKCE mismatch, and a
    // provider error alike: the contributor gets one identical, generic
    // message either way, but the container's logs keep the real cause so a
    // genuine regression is distinguishable from someone clicking "cancel".
    //
    // Logged at full depth on purpose: when a provider rejects the exchange,
    // the reason is its own error body nested inside openid-client's cause
    // chain, and the default console depth prints it as `[Object]` — hiding
    // the one fact worth having.
    console.error(`auth callback error (${name}):`, inspect(error, { depth: null }))
    await session.save()
    return NextResponse.redirect(withNotice(home, 'link-failed', name))
  }

  if (name === 'github') {
    // `username` is optional on Identity; it is populated here only because
    // github.ts's toIdentity currently guarantees it. That guarantee lives in
    // another module and isn't visible to the compiler here, so it is
    // re-checked at runtime rather than asserted — an absent username fails
    // the same way every other provider error already does, instead of
    // writing `login: undefined` into a session field typed `string`.
    if (!identity.username) {
      console.error(`github callback: identity had no username (providerId=${identity.providerId})`)
      await session.save()
      return NextResponse.redirect(withNotice(home, 'link-failed', name))
    }
    // A pending Telegram/Discord link belongs to whichever GitHub identity
    // was in the session when the link was made. Signing in as a *different*
    // GitHub account in the same browser must not carry it over — or saving
    // would write a stranger's link into this identity's row, and the
    // telegram_id/discord_id unique constraint would then block the
    // rightful owner from ever linking their own account.
    if (session.github && session.github.id !== identity.providerId) {
      session.pending = undefined
    }
    session.github = { id: identity.providerId, login: identity.username }
    await session.save()
    return NextResponse.redirect(home)
  }

  if (name === 'discord') {
    session.pending = { ...session.pending, discord: identity }
    await session.save()
    return NextResponse.redirect(home)
  }

  const outcome = resolveTelegramOutcome(identity, transaction.variant)
  if (outcome.kind === 'retry-with-phone') {
    await session.save()
    return NextResponse.redirect(new URL('/auth/telegram?variant=phone', env.APP_URL))
  }
  if (outcome.kind === 'failed') {
    await session.save()
    return NextResponse.redirect(withNotice(home, 'telegram-no-contact'))
  }

  session.pending = { ...session.pending, telegram: outcome.identity }
  await session.save()
  return NextResponse.redirect(home)
}
