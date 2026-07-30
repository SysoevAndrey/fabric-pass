import { NextResponse } from 'next/server'
import { parseRegistryYaml } from '@/lib/contributors-registry'
import { syncContributorStatuses } from '@/lib/contributors'
import { env } from '@/lib/env'
import { isAuthorized } from '@/lib/internal-auth'

/** Called by cf-internal's push-triggered shim workflow whenever
 * pass/contributors.yaml changes — whether from an admin's manual edit or
 * fabric-pass's own export committing back. Only `status` is ever written
 * here; see contributors-registry.ts's module doc for why. */
export async function POST(request: Request) {
  if (!isAuthorized(request, env.CONTRIBUTORS_SYNC_SECRET)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await request.text()
  const { updates, invalidRowCount } = parseRegistryYaml(body)
  const { updated, notFound } = await syncContributorStatuses(updates)

  if (invalidRowCount > 0) {
    console.warn(`contributors sync: ${invalidRowCount} row(s) skipped — missing/invalid github_id or status`)
  }
  if (notFound.length > 0) {
    console.warn(`contributors sync: no matching contributor for github_id(s): ${notFound.join(', ')}`)
  }

  return NextResponse.json({ updated: updated.length, skipped: invalidRowCount + notFound.length })
}
