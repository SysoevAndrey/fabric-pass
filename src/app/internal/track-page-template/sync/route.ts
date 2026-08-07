import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { isAuthorized } from '@/lib/internal-auth'
import { syncTrackPageTemplate } from '@/lib/track-page-template'

/** Called by cf-internal's push-triggered shim workflow whenever
 * pass/track-page.md changes. One-way — see track-page-template.ts's
 * module doc — so there's no matching export route. No parsing step: the
 * whole request body *is* the template, stored as-is. */
export async function POST(request: Request) {
  if (!isAuthorized(request, env.TRACK_PAGE_TEMPLATE_SYNC_SECRET)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const content = await request.text()
  await syncTrackPageTemplate(content)

  return NextResponse.json({ synced: true })
}
