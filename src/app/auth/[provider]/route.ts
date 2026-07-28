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
  session.oauth = { provider: name, codeVerifier, state, variant }
  await session.save()

  return NextResponse.redirect(url)
}
