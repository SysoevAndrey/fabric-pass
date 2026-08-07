import { afterAll, beforeEach, expect, test } from 'vitest'
import { POST as syncRoute } from '@/app/internal/config/sync/route'
import { getAppConfig } from '@/lib/app-config'
import { pool } from '@/lib/db'

// tests/setup.ts has loaded .env.test, so this matches its CONFIG_SYNC_SECRET.
const SYNC_SECRET = 'test-config-sync-secret'

beforeEach(async () => {
  await pool.query('TRUNCATE app_config')
})

afterAll(async () => {
  await pool.end()
})

test('refuses a request with no or the wrong secret', async () => {
  const noAuth = await syncRoute(
    new Request('http://localhost/internal/config/sync', { method: 'POST', body: 'github_organization: constructorfabric' }),
  )
  expect(noAuth.status).toBe(401)

  const wrongAuth = await syncRoute(
    new Request('http://localhost/internal/config/sync', {
      method: 'POST',
      body: 'github_organization: constructorfabric',
      headers: { authorization: 'Bearer nope' },
    }),
  )
  expect(wrongAuth.status).toBe(401)
})

test('syncs a valid config.yaml', async () => {
  const response = await syncRoute(
    new Request('http://localhost/internal/config/sync', {
      method: 'POST',
      headers: { authorization: `Bearer ${SYNC_SECRET}` },
      body: 'github_organization: constructorfabric\ndiscord_guild_id: "123"\ndiscord_invite_url: https://discord.gg/example\n',
    }),
  )

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ synced: true })
  expect(await getAppConfig()).toEqual({
    githubOrganization: 'constructorfabric',
    discordGuildId: '123',
    discordInviteUrl: 'https://discord.gg/example',
  })
})

test('reports 400 for a malformed config.yaml without touching the stored config', async () => {
  await syncRoute(
    new Request('http://localhost/internal/config/sync', {
      method: 'POST',
      headers: { authorization: `Bearer ${SYNC_SECRET}` },
      body: 'github_organization: constructorfabric\n',
    }),
  )

  const response = await syncRoute(
    new Request('http://localhost/internal/config/sync', {
      method: 'POST',
      headers: { authorization: `Bearer ${SYNC_SECRET}` },
      body: 'github_organization: [not, a, string]\n',
    }),
  )

  expect(response.status).toBe(400)
  expect((await getAppConfig())?.githubOrganization).toBe('constructorfabric')
})
