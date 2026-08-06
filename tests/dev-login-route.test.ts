import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { pool } from '@/lib/db'

// The route reads cookies via getSession() — replaced with an in-memory
// double, the same seam the auth-callback guard tests use. The database is
// the real test one: which row the `as` parameter resolves to is exactly
// what's under test.
const { fakeSession } = vi.hoisted(() => ({
  fakeSession: {
    github: undefined as { id: string; login: string } | undefined,
    save: async () => {},
  },
}))

vi.mock('@/lib/session', () => ({
  getSession: async () => fakeSession,
}))

const { GET } = await import('@/app/dev-login/route.dev')

function devLoginRequest(url: string, host = 'localhost:3000') {
  return new NextRequest(url, { headers: { host } })
}

beforeEach(async () => {
  fakeSession.github = undefined
  await pool.query('TRUNCATE tracks, contributors CASCADE')
  await pool.query(
    `INSERT INTO contributors (github_id, github_login, name, status)
     VALUES ('583231', 'octocat', 'Ada Lovelace', 'confirmed')`,
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
})

afterAll(async () => {
  await pool.end()
})

// NODE_ENV is 'test' here, not 'development' — exactly the situation the
// guard exists for. In a real production build the route doesn't exist at
// all (its `.dev.ts` extension is only a page extension in development —
// see next.config.ts); this guard is the second line of defense, for any
// non-development runtime that still has the module.
test('outside a development build the route is a 404 and never touches the session', async () => {
  const response = await GET(devLoginRequest('http://localhost:3000/dev-login?as=octocat'))

  expect(response.status).toBe(404)
  expect(fakeSession.github).toBeUndefined()
})

test('a development server still refuses a request that arrived at a non-loopback host', async () => {
  vi.stubEnv('NODE_ENV', 'development')

  // `pnpm dev --hostname 0.0.0.0` serves the LAN; the Host header is the
  // only thing distinguishing a neighbor's request from the developer's own.
  const response = await GET(devLoginRequest('http://localhost:3000/dev-login?as=octocat', '10.0.0.5:3000'))

  expect(response.status).toBe(404)
  expect(fakeSession.github).toBeUndefined()
})

test('signing in as an existing contributor takes both session fields from that row', async () => {
  vi.stubEnv('NODE_ENV', 'development')

  const response = await GET(devLoginRequest('http://localhost:3000/dev-login?as=OCTOCAT'))

  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('http://localhost:3000/')
  // Resolved from the database row — including the login's canonical casing,
  // not the query parameter's.
  expect(fakeSession.github).toEqual({ id: '583231', login: 'octocat' })
})

test('an unknown login is refused without signing anyone in', async () => {
  vi.stubEnv('NODE_ENV', 'development')

  const response = await GET(devLoginRequest('http://localhost:3000/dev-login?as=nobody'))

  expect(response.status).toBe(404)
  expect(fakeSession.github).toBeUndefined()
})

test('without a login parameter the route lists the local contributors to pick from', async () => {
  vi.stubEnv('NODE_ENV', 'development')

  const response = await GET(devLoginRequest('http://localhost:3000/dev-login'))

  expect(response.status).toBe(200)
  const body = await response.text()
  expect(body).toContain('Ada Lovelace')
  expect(body).toContain('/dev-login?as=octocat')
  expect(fakeSession.github).toBeUndefined()
})
