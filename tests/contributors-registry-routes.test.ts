import { afterAll, beforeEach, expect, test } from 'vitest'
import { GET as exportRoute } from '@/app/internal/contributors/export/route'
import { POST as syncRoute } from '@/app/internal/contributors/sync/route'
import { ensureContributor, findByGithubId } from '@/lib/contributors'
import { pool } from '@/lib/db'

// tests/setup.ts has loaded .env.test, so these match its
// CONTRIBUTORS_EXPORT_SECRET / CONTRIBUTORS_SYNC_SECRET.
const EXPORT_SECRET = 'test-contributors-export-secret'
const SYNC_SECRET = 'test-contributors-sync-secret'

beforeEach(async () => {
  // CASCADE: track_admins/tracks (migrations/010_tracks.sql) FK-reference
  // contributors, so a plain TRUNCATE contributors is refused outright.
  await pool.query('TRUNCATE contributors CASCADE')
})

afterAll(async () => {
  await pool.end()
})

test('export refuses a request with no or the wrong secret', async () => {
  const noAuth = await exportRoute(new Request('http://localhost/internal/contributors/export'))
  expect(noAuth.status).toBe(401)

  const wrongAuth = await exportRoute(
    new Request('http://localhost/internal/contributors/export', { headers: { authorization: 'Bearer nope' } }),
  )
  expect(wrongAuth.status).toBe(401)
})

test('export returns every contributor as registry YAML', async () => {
  await ensureContributor('1001', 'octocat', 'The Octocat', 'octocat@github.com')

  const response = await exportRoute(
    new Request('http://localhost/internal/contributors/export', {
      headers: { authorization: `Bearer ${EXPORT_SECRET}` },
    }),
  )

  expect(response.status).toBe(200)
  const body = await response.text()
  expect(body).toContain('github_id: "1001"')
  expect(body).toContain('github_login: octocat')
  expect(body).toContain('status: draft')
})

test('sync refuses a request with no or the wrong secret', async () => {
  const response = await syncRoute(
    new Request('http://localhost/internal/contributors/sync', { method: 'POST', body: 'contributors: []' }),
  )
  expect(response.status).toBe(401)
})

test('sync applies status, alias_of_github_id, and is_agent from the registry file to the matching contributor', async () => {
  await ensureContributor('1001', 'octocat')
  await ensureContributor('2002', 'grace')

  const response = await syncRoute(
    new Request('http://localhost/internal/contributors/sync', {
      method: 'POST',
      headers: { authorization: `Bearer ${SYNC_SECRET}` },
      body:
        'contributors:\n' +
        '  - github_id: "1001"\n    status: confirmed\n' +
        '  - github_id: "2002"\n    status: draft\n    alias_of_github_id: "1001"\n    is_agent: true\n',
    }),
  )

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ updated: 2, skipped: 0 })
  expect((await findByGithubId('1001'))?.status).toBe('confirmed')
  const alias = await findByGithubId('2002')
  expect(alias?.aliasOfGithubId).toBe('1001')
  expect(alias?.isAgent).toBe(true)
})
