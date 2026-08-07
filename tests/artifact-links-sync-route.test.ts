import { afterAll, beforeEach, expect, test } from 'vitest'
import { POST as syncRoute } from '@/app/internal/artifact-links/sync/route'
import { COMMUNITY_SCOPE, listArtifactLinks } from '@/lib/artifact-links'
import { pool } from '@/lib/db'

// tests/setup.ts has loaded .env.test, so this matches its ARTIFACT_LINKS_SYNC_SECRET.
const SYNC_SECRET = 'test-artifact-links-sync-secret'

beforeEach(async () => {
  await pool.query('TRUNCATE artifact_links, tracks, contributors CASCADE')
})

afterAll(async () => {
  await pool.end()
})

test('refuses a request with no or the wrong secret', async () => {
  const noAuth = await syncRoute(
    new Request('http://localhost/internal/artifact-links/sync', { method: 'POST', body: 'artifact_links: []' }),
  )
  expect(noAuth.status).toBe(401)

  const wrongAuth = await syncRoute(
    new Request('http://localhost/internal/artifact-links/sync', {
      method: 'POST',
      body: 'artifact_links: []',
      headers: { authorization: 'Bearer nope' },
    }),
  )
  expect(wrongAuth.status).toBe(401)
})

test('syncs artifact links from the registry file', async () => {
  const response = await syncRoute(
    new Request('http://localhost/internal/artifact-links/sync', {
      method: 'POST',
      headers: { authorization: `Bearer ${SYNC_SECRET}` },
      body: 'artifact_links:\n  - scope: community\n    category: policy\n    label: Code of Conduct\n    url: https://example.com/coc\n',
    }),
  )

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ synced: 1, skipped: 0 })

  const links = await listArtifactLinks(COMMUNITY_SCOPE)
  expect(links).toHaveLength(1)
  expect(links[0].label).toBe('Code of Conduct')
})

test('reports invalid rows and unresolved scopes as skipped, without failing the request', async () => {
  const response = await syncRoute(
    new Request('http://localhost/internal/artifact-links/sync', {
      method: 'POST',
      headers: { authorization: `Bearer ${SYNC_SECRET}` },
      body: 'artifact_links:\n  - label: no scope or category or url\n  - scope: not-a-real-track\n    category: guide\n    label: Orphaned\n    url: https://example.com\n',
    }),
  )

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ synced: 0, skipped: 2 })
})
