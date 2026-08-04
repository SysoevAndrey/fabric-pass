import { expect, test } from 'vitest'
import { toIdentity } from './linkedin.ts'

test('takes the subject and name claims', () => {
  const identity = toIdentity({ sub: '782bJ92', name: 'Ada Lovelace' })
  expect(identity).toEqual({ providerId: '782bJ92', name: 'Ada Lovelace' })
})

test('leaves name out entirely when the claim is absent', () => {
  const identity = toIdentity({ sub: '782bJ92' })
  expect(identity).toEqual({ providerId: '782bJ92' })
})

test('never carries a username — LinkedIn has no such claim', () => {
  const identity = toIdentity({ sub: '782bJ92', name: 'Ada Lovelace' })
  expect(identity.username).toBeUndefined()
})

// The `openid profile email` scope requested by authRequest still returns an
// email claim — this asserts it never leaks into the stored identity, since
// nothing here reads or stores it (data minimization).
test('never carries an email, even though the claims payload has one', () => {
  const identity = toIdentity({ sub: '782bJ92', name: 'Ada Lovelace', email: 'ada@example.com' })
  expect(identity).not.toHaveProperty('email')
})

test('rejects claims with no subject', () => {
  expect(() => toIdentity({ name: 'Ada Lovelace' })).toThrow(/sub/)
})
