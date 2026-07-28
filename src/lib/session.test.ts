import { expect, test } from 'vitest'
import { sealData, unsealData } from 'iron-session'
import { env } from '@/lib/env'
import { sessionOptions } from './session.ts'
import type { SessionData } from './session.ts'

test('the cookie is not marked secure over http, and httpOnly is on', () => {
  // Made explicit rather than assumed: this test's meaning depends on
  // .env.test setting APP_URL to an http:// URL. If that ever changes to
  // https, this assertion should fail loudly here rather than the `secure`
  // assertion below silently flipping to true and passing for the wrong reason.
  expect(env.APP_URL.startsWith('http://')).toBe(true)

  expect(sessionOptions.cookieOptions?.secure).toBe(false)
  expect(sessionOptions.cookieOptions?.httpOnly).toBe(true)
})

test('a session round-trips through sealing intact', async () => {
  const data: SessionData = {
    github: { id: '1001', login: 'octocat' },
    pending: { telegram: { providerId: '555', username: 'ada' } },
  }

  const sealed = await sealData(data, { password: sessionOptions.password })
  const opened = await unsealData<SessionData>(sealed, { password: sessionOptions.password })

  expect(opened.github?.login).toBe('octocat')
  expect(opened.pending?.telegram?.username).toBe('ada')
})

test('the cookie leaks nothing without the password', async () => {
  const data: SessionData = { github: { id: '1001', login: 'octocat' } }
  const sealed = await sealData(data, { password: sessionOptions.password })

  // The payload is encrypted, not merely signed, so the login must not appear.
  expect(sealed).not.toContain('octocat')

  // iron-session does not throw on a bad password — it recovers nothing.
  const opened = await unsealData<SessionData>(sealed, { password: 'a'.repeat(32) })
  expect(opened.github).toBeUndefined()
})
