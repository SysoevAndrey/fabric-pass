import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { isAuthorized } from '@/lib/internal-auth'
import { parseTracksYaml } from '@/lib/tracks-registry'
import { syncTracks } from '@/lib/tracks'

/** Called by cf-internal's push-triggered shim workflow whenever
 * pass/tracks.yaml changes. One-way — see tracks.ts's module doc — so
 * unlike /internal/contributors/*, there's no matching export route. */
export async function POST(request: Request) {
  if (!isAuthorized(request, env.TRACKS_SYNC_SECRET)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await request.text()
  const { tracks, invalidRowCount } = parseTracksYaml(body)
  const { synced, rejected } = await syncTracks(tracks)

  if (invalidRowCount > 0) {
    console.warn(`tracks sync: ${invalidRowCount} row(s) skipped — missing/invalid slug or name`)
  }
  if (rejected.length > 0) {
    console.warn(`tracks sync: unknown leader/admin github login for track(s): ${rejected.join(', ')}`)
  }

  return NextResponse.json({ synced: synced.length, skipped: invalidRowCount + rejected.length })
}
