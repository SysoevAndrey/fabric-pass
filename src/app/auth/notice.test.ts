import { expect, test } from 'vitest'
import { noticeMessage, withNotice } from './notice.ts'

test('an already-linked notice names the provider that conflicted', () => {
  expect(noticeMessage('already-linked', 'telegram')).toBe(
    'That telegram account is already linked to another contributor.',
  )
})

test('an already-linked notice with no provider still reads sensibly', () => {
  expect(noticeMessage('already-linked', undefined)).toBe('That account is already linked to another contributor.')
})

test('an unrecognized code shows nothing rather than failing', () => {
  expect(noticeMessage('not-a-real-code', 'telegram')).toBeUndefined()
})

test('withNotice round-trips through noticeMessage', () => {
  const url = withNotice(new URL('http://localhost:3000/'), 'already-linked', 'discord')
  expect(noticeMessage(url.searchParams.get('notice') ?? undefined, url.searchParams.get('provider') ?? undefined)).toBe(
    'That discord account is already linked to another contributor.',
  )
})

test('an identity-changed notice names the provider that was being linked', () => {
  expect(noticeMessage('identity-changed', 'discord')).toBe(
    'You signed in as a different GitHub account while linking discord. Please start the discord link again.',
  )
})

test('an identity-changed notice with no provider still reads sensibly', () => {
  expect(noticeMessage('identity-changed', undefined)).toBe(
    'You signed in as a different GitHub account partway through. Please try again.',
  )
})

test('a reauth-required notice tells the person to sign in again, not to retry', () => {
  expect(noticeMessage('reauth-required', undefined)).toMatch(/sign in/i)
})
