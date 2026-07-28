import { expect, test } from 'vitest'
import type { ZodError } from 'zod'
import { toIdentity } from './github.ts'

test('takes the numeric id and login from a github profile', () => {
  const identity = toIdentity({ id: 583231, login: 'octocat', name: 'The Octocat' })
  expect(identity).toEqual({ providerId: '583231', username: 'octocat' })
})

test('stringifies an id beyond Number.MAX_SAFE_INTEGER with no further precision loss', () => {
  // A literal this large written directly in source is already rounded by
  // the JS parser before this test even runs, so it can't tell a correct
  // `String(id)` conversion from a broken one — every input would look the
  // same. Going through JSON.parse of a string instead exercises the exact
  // path production uses (`response.json()` parses wire bytes the same
  // way), so the assertion checks the real value that conversion sees, not
  // just its type.
  const profile = JSON.parse('{"id": 9007199254740993, "login": "big"}')
  expect(profile.id).toBe(9007199254740992) // JSON.parse's own double rounding, not toIdentity's
  const identity = toIdentity(profile)
  expect(identity.providerId).toBe('9007199254740992')
})

test('rejects a profile with no login', () => {
  expect(() => toIdentity({ id: 1 })).toThrow(/login/)
})

test('rejects a profile with no id', () => {
  try {
    toIdentity({ login: 'octocat' })
    expect.unreachable('a profile with no id must be rejected')
  } catch (error) {
    // A /id/ regex on the message would also match Zod's "invalid_type" code
    // (it contains the substring "id"), so it would pass even for a missing
    // login. Assert the failing path instead — the same fix already applied
    // to discord.test.ts.
    expect((error as ZodError).issues.map((issue) => issue.path)).toEqual([['id']])
  }
})
