import { expect, test } from 'vitest'
import type { ZodError } from 'zod'
import { toIdentity } from './discord.ts'

test('takes the snowflake id and username', () => {
  const identity = toIdentity({ id: '80351110224678912', username: 'nelly', global_name: 'Nelly' })
  expect(identity).toEqual({ providerId: '80351110224678912', username: 'nelly', name: 'Nelly' })
})

test('leaves name out entirely when the account has none set', () => {
  const identity = toIdentity({ id: '80351110224678912', username: 'nelly', global_name: null })
  expect(identity.name).toBeUndefined()
})

test('rejects a profile with no username', () => {
  expect(() => toIdentity({ id: '80351110224678912' })).toThrow(/username/)
})

test('rejects a profile with no id', () => {
  try {
    toIdentity({ username: 'nelly' })
    expect.unreachable('a profile with no id must be rejected')
  } catch (error) {
    // A /id/ regex on the message would also match Zod's "invalid_type" code,
    // so it passes for a missing username too. Assert the failing path instead.
    expect((error as ZodError).issues.map((issue) => issue.path)).toEqual([['id']])
  }
})
