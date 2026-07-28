import { expect, test } from 'vitest'
import { toIdentity } from './github.ts'

test('takes the numeric id and login from a github profile', () => {
  const identity = toIdentity({ id: 583231, login: 'octocat', name: 'The Octocat' })
  expect(identity).toEqual({ providerId: '583231', username: 'octocat' })
})

test('keeps the id as a string so large ids survive intact', () => {
  const identity = toIdentity({ id: 9007199254740993, login: 'big' })
  expect(typeof identity.providerId).toBe('string')
})

test('rejects a profile with no login', () => {
  expect(() => toIdentity({ id: 1 })).toThrow(/login/)
})

test('rejects a profile with no id', () => {
  expect(() => toIdentity({ login: 'octocat' })).toThrow(/id/)
})
