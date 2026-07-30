import { NextResponse } from 'next/server'
import { toRegistryYaml } from '@/lib/contributors-registry'
import { listContributorsForRegistry } from '@/lib/contributors'
import { env } from '@/lib/env'
import { isAuthorized } from '@/lib/internal-auth'

/** Called by fabric-pass's own scheduled export workflow — see
 * .github/workflows/export-contributors.yml — which writes the response
 * straight into cf-internal's pass/contributors.yaml. */
export async function GET(request: Request) {
  if (!isAuthorized(request, env.CONTRIBUTORS_EXPORT_SECRET)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const contributors = await listContributorsForRegistry()
  return new NextResponse(toRegistryYaml(contributors), {
    headers: { 'content-type': 'application/yaml; charset=utf-8' },
  })
}
