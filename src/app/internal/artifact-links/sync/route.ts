import { NextResponse } from 'next/server'
import { syncArtifactLinks } from '@/lib/artifact-links'
import { parseArtifactLinksYaml } from '@/lib/artifact-links-registry'
import { env } from '@/lib/env'
import { isAuthorized } from '@/lib/internal-auth'

/** Called by cf-internal's push-triggered shim workflow whenever
 * pass/artifact-links.yaml changes. One-way — see artifact-links.ts's
 * module doc — so there's no matching export route. */
export async function POST(request: Request) {
  if (!isAuthorized(request, env.ARTIFACT_LINKS_SYNC_SECRET)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await request.text()
  const { links, invalidRowCount } = parseArtifactLinksYaml(body)
  const { synced, rejected } = await syncArtifactLinks(links)

  if (invalidRowCount > 0) {
    console.warn(`artifact-links sync: ${invalidRowCount} row(s) skipped — missing/invalid scope, category, label, or url`)
  }
  if (rejected > 0) {
    console.warn(`artifact-links sync: ${rejected} row(s) skipped — scope names neither "community" nor a real track slug`)
  }

  return NextResponse.json({ synced, skipped: invalidRowCount + rejected })
}
