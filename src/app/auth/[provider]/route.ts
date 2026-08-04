import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { isProviderName, providers } from '@/lib/providers'
import { getSession } from '@/lib/session'

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await context.params
  if (!isProviderName(name)) return new NextResponse('Unknown provider', { status: 404 })

  const provider = providers[name]
  // LinkedIn is this app's only provider that can be a known name
  // (isProviderName above) yet still have nothing to hand back — see
  // lib/providers/index.ts. Refused the same way an unknown name is: there's
  // no meaningful distinction to surface to a client hitting either case.
  if (!provider) return new NextResponse('Unknown provider', { status: 404 })

  const variant = new URL(request.url).searchParams.get('variant') === 'phone' ? 'phone' : undefined
  const redirectUri = `${env.APP_URL}/auth/${name}/callback`

  const { url, codeVerifier, state } = await provider.authRequest(redirectUri, variant)

  const session = await getSession()
  // Keyed by provider, so starting this flow leaves any other provider's
  // in-flight transaction (e.g. Discord started before Telegram finished)
  // untouched — only this provider's own slot is replaced. `githubId` records
  // whoever is signed in right now, if anyone, so the callback can refuse to
  // complete this transaction under a different identity later (see
  // session.ts's OAuthTransaction and the callback route).
  session.oauth = { ...session.oauth, [name]: { codeVerifier, state, variant, githubId: session.github?.id } }
  await session.save()

  return NextResponse.redirect(url)
}
