import { expect, test } from 'vitest'
import { toIdentity } from './telegram.ts'

test('prefers the username when the account has one', () => {
  const identity = toIdentity({ sub: '4242', preferred_username: 'ada' })
  expect(identity).toEqual({ providerId: '4242', username: 'ada' })
})

test('falls back to the phone number when there is no username', () => {
  const identity = toIdentity({ sub: '4242', phone_number: '+359888123456' })
  expect(identity).toEqual({ providerId: '4242', phone: '+359888123456' })
})

test('keeps only the username when both are present', () => {
  const identity = toIdentity({ sub: '4242', preferred_username: 'ada', phone_number: '+359888123456' })
  expect(identity).toEqual({ providerId: '4242', username: 'ada' })
})

test('returns neither when the account has no username and no phone consent', () => {
  const identity = toIdentity({ sub: '4242' })
  expect(identity).toEqual({ providerId: '4242' })
})

test('carries the name claim alongside a username', () => {
  const identity = toIdentity({ sub: '4242', preferred_username: 'ada', name: 'Ada Lovelace' })
  expect(identity.name).toBe('Ada Lovelace')
})

test('carries the name claim alongside a phone fallback', () => {
  const identity = toIdentity({ sub: '4242', phone_number: '+359888123456', name: 'Ada Lovelace' })
  expect(identity.name).toBe('Ada Lovelace')
})

test('leaves name out entirely when the claim is empty', () => {
  const identity = toIdentity({ sub: '4242', preferred_username: 'ada', name: '' })
  expect(identity.name).toBeUndefined()
})

test('rejects claims with no subject', () => {
  expect(() => toIdentity({ preferred_username: 'ada' })).toThrow(/sub/)
})
