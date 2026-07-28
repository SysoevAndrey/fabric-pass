import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { isProviderName, providers } from '@/lib/providers'
import { getSession } from '@/lib/session'

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await context.params
  if (!isProviderName(name)) return new NextResponse('Unknown provider', { status: 404 })

  const variant = new URL(request.url).searchParams.get('variant') === 'phone' ? 'phone' : undefined
  const redirectUri = `${env.APP_URL}/auth/${name}/callback`

  const provider = providers[name]
  const { url, codeVerifier, state } = await provider.authRequest(redirectUri, variant)

  const session = await getSession()
  // Keyed by provider, so starting this flow leaves any other provider's
  // in-flight transaction (e.g. Discord started before Telegram finished)
  // untouched — only this provider's own slot is replaced.
  session.oauth = { ...session.oauth, [name]: { codeVerifier, state, variant } }
  await session.save()

  return NextResponse.redirect(url)
}
