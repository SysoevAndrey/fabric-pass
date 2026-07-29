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
