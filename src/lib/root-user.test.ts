import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// `env` is a module-level singleton parsed from `process.env` once, at
// import time (see env.ts) — so exercising more than one ROOT_GITHUB_ID
// value needs a fresh module graph per test, the same seam
// telegram.caching.test.ts uses for its own env-shaped state.
beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test('is false for any id when ROOT_GITHUB_ID is unset', async () => {
  vi.stubEnv('ROOT_GITHUB_ID', undefined)
  const { isRootUser } = await import('./root-user.ts')
  expect(isRootUser('12345')).toBe(false)
})

test('is false for any id when ROOT_GITHUB_ID is blank', async () => {
  vi.stubEnv('ROOT_GITHUB_ID', '')
  const { isRootUser } = await import('./root-user.ts')
  expect(isRootUser('12345')).toBe(false)
})

test('is true for the id matching ROOT_GITHUB_ID', async () => {
  vi.stubEnv('ROOT_GITHUB_ID', '12345')
  const { isRootUser } = await import('./root-user.ts')
  expect(isRootUser('12345')).toBe(true)
})

test('is false for an id that does not match ROOT_GITHUB_ID', async () => {
  vi.stubEnv('ROOT_GITHUB_ID', '12345')
  const { isRootUser } = await import('./root-user.ts')
  expect(isRootUser('99999')).toBe(false)
})
