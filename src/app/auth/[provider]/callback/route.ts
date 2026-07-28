import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { isProviderName, providers } from '@/lib/providers'
import { getSession } from '@/lib/session'
import { resolveTelegramOutcome } from './outcome'

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await context.params
  if (!isProviderName(name)) return new NextResponse('Unknown provider', { status: 404 })

  const session = await getSession()
  const transaction = session.oauth
  const home = new URL('/', env.APP_URL)

  // A callback with no matching transaction is a replay or a stale tab.
  if (!transaction || transaction.provider !== name) {
    session.error = 'That sign-in link has expired. Please try again.'
    session.oauth = undefined
    await session.save()
    return NextResponse.redirect(home)
  }

  const redirectUri = `${env.APP_URL}/auth/${name}/callback`
  session.oauth = undefined

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
    console.error(`auth callback error (${name}):`, error)
    session.error = `Linking ${name} did not complete. Please try again.`
    await session.save()
    return NextResponse.redirect(home)
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
      session.error = `Linking ${name} did not complete. Please try again.`
      await session.save()
      return NextResponse.redirect(home)
    }
    session.github = { id: identity.providerId, login: identity.username }
    session.error = undefined
    await session.save()
    return NextResponse.redirect(home)
  }

  if (name === 'discord') {
    session.pending = { ...session.pending, discord: identity }
    session.error = undefined
    await session.save()
    return NextResponse.redirect(home)
  }

  const outcome = resolveTelegramOutcome(identity, transaction.variant)
  if (outcome.kind === 'retry-with-phone') {
    await session.save()
    return NextResponse.redirect(new URL('/auth/telegram?variant=phone', env.APP_URL))
  }
  if (outcome.kind === 'failed') {
    session.error = outcome.message
    await session.save()
    return NextResponse.redirect(home)
  }

  session.pending = { ...session.pending, telegram: outcome.identity }
  session.error = undefined
  await session.save()
  return NextResponse.redirect(home)
}
