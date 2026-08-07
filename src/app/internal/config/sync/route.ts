import { NextResponse } from 'next/server'
import { syncAppConfig } from '@/lib/app-config'
import { parseConfigYaml } from '@/lib/app-config-registry'
import { env } from '@/lib/env'
import { isAuthorized } from '@/lib/internal-auth'

/** Called by cf-internal's push-triggered shim workflow whenever
 * pass/config.yaml changes. One-way — see app-config.ts's module doc — so
 * there's no matching export route. Unlike the other sync routes, a
 * malformed file has nothing partial to salvage (one flat object, not a
 * list of rows), so a parse failure here reports 400 rather than skipping
 * and reporting a count. */
export async function POST(request: Request) {
  if (!isAuthorized(request, env.CONFIG_SYNC_SECRET)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await request.text()
  let config
  try {
    config = parseConfigYaml(body)
  } catch (error) {
    console.error('config sync: pass/config.yaml failed to parse:', error)
    return new NextResponse('Invalid config.yaml', { status: 400 })
  }

  await syncAppConfig(config)
  return NextResponse.json({ synced: true })
}
