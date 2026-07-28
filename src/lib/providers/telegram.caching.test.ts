import { beforeEach, expect, test, vi } from 'vitest'

// `configuration()` is not exported, and it wraps a network call
// (`client.discovery`), so the seam we stub is the `openid-client` import
// itself — not an internal of telegram.ts. Every other export used by
// `authRequest` is stubbed too, purely so the call can complete without a
// real Configuration object; only `discovery`'s call count and
// resolve/reject sequence are under test here.
const { discovery } = vi.hoisted(() => ({ discovery: vi.fn() }))

vi.mock('openid-client', () => ({
  discovery,
  randomPKCECodeVerifier: () => 'verifier',
  calculatePKCECodeChallenge: async () => 'challenge',
  randomState: () => 'state',
  buildAuthorizationUrl: () => new URL('https://oauth.telegram.org/auth?mock=1'),
}))

beforeEach(() => {
  vi.resetModules()
  discovery.mockReset()
})

test('a failed discovery is not cached forever — a later attempt can still succeed', async () => {
  discovery.mockRejectedValueOnce(new Error('discovery unreachable'))
  discovery.mockResolvedValueOnce({} as never)

  const { telegram } = await import('./telegram.ts')

  await expect(telegram.authRequest('http://localhost/callback')).rejects.toThrow('discovery unreachable')
  await expect(telegram.authRequest('http://localhost/callback')).resolves.toBeDefined()

  expect(discovery).toHaveBeenCalledTimes(2)
})

test('a successful discovery is memoised — a second call does not trigger a second discovery', async () => {
  discovery.mockResolvedValue({} as never)

  const { telegram } = await import('./telegram.ts')

  await telegram.authRequest('http://localhost/callback')
  await telegram.authRequest('http://localhost/callback')

  expect(discovery).toHaveBeenCalledTimes(1)
})
