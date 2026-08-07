import { afterAll, beforeEach, expect, test } from 'vitest'
import { POST as syncRoute } from '@/app/internal/track-page-template/sync/route'
import { pool } from '@/lib/db'
import { getTrackPageTemplate } from '@/lib/track-page-template'

// tests/setup.ts has loaded .env.test, so this matches its TRACK_PAGE_TEMPLATE_SYNC_SECRET.
const SYNC_SECRET = 'test-track-page-template-sync-secret'

beforeEach(async () => {
  await pool.query('TRUNCATE track_page_template')
})

afterAll(async () => {
  await pool.end()
})

test('refuses a request with no or the wrong secret', async () => {
  const noAuth = await syncRoute(
    new Request('http://localhost/internal/track-page-template/sync', { method: 'POST', body: '# {{name}}' }),
  )
  expect(noAuth.status).toBe(401)

  const wrongAuth = await syncRoute(
    new Request('http://localhost/internal/track-page-template/sync', {
      method: 'POST',
      body: '# {{name}}',
      headers: { authorization: 'Bearer nope' },
    }),
  )
  expect(wrongAuth.status).toBe(401)
})

test('stores the request body as the template, verbatim', async () => {
  const response = await syncRoute(
    new Request('http://localhost/internal/track-page-template/sync', {
      method: 'POST',
      headers: { authorization: `Bearer ${SYNC_SECRET}` },
      body: '## {{name}}\n\n{{description}}\n',
    }),
  )

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ synced: true })
  expect(await getTrackPageTemplate()).toBe('## {{name}}\n\n{{description}}\n')
})
