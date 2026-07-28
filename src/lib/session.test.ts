import { expect, test } from 'vitest'
import { sealData, unsealData } from 'iron-session'
import { sessionOptions } from './session.ts'
import type { SessionData } from './session.ts'

test('the session password meets the iron-session minimum', () => {
  expect(sessionOptions.password.length).toBeGreaterThanOrEqual(32)
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
