import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// LinkedIn is this app's only optional provider (see lib/env.ts) — .env.test
// deliberately leaves LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET unset, so the
// default test environment already exercises the "unconfigured" state these
// tests check, with no mocking of '@/lib/providers' or '@/lib/session'
// needed: both routes below return their 404 before session.ts's
// `getSession()` (which needs `next/headers`' request scope) is ever called.

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test('providers omits linkedin when its credentials are unset', async () => {
  const { providers, isProviderConfigured } = await import('@/lib/providers')

  expect(providers.linkedin).toBeUndefined()
  expect(isProviderConfigured('linkedin')).toBe(false)
})

test('providers admits linkedin once both its credentials are set', async () => {
  vi.stubEnv('LINKEDIN_CLIENT_ID', 'test-linkedin-client-id')
  vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'test-linkedin-client-secret')

  const { providers, isProviderConfigured } = await import('@/lib/providers')

  expect(providers.linkedin).toBeDefined()
  expect(isProviderConfigured('linkedin')).toBe(true)
})

test('GET /auth/linkedin responds 404 when LinkedIn is not configured', async () => {
  const { GET } = await import('@/app/auth/[provider]/route')

  const response = await GET(new Request('http://localhost:3000/auth/linkedin'), {
    params: Promise.resolve({ provider: 'linkedin' }),
  })

  expect(response.status).toBe(404)
})

test('GET /auth/linkedin/callback responds 404 when LinkedIn is not configured', async () => {
  const { GET } = await import('@/app/auth/[provider]/callback/route')

  const response = await GET(new Request('http://localhost:3000/auth/linkedin/callback?code=abc&state=xyz'), {
    params: Promise.resolve({ provider: 'linkedin' }),
  })

  expect(response.status).toBe(404)
})
