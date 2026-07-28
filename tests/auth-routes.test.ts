import { expect, test } from 'vitest'
import { resolveTelegramOutcome } from '@/app/auth/[provider]/callback/outcome'

test('a username completes the telegram link', () => {
  const outcome = resolveTelegramOutcome({ providerId: '1', username: 'ada' }, undefined)
  expect(outcome).toEqual({ kind: 'link', identity: { providerId: '1', username: 'ada' } })
})

test('no username on the first pass asks for a phone', () => {
  const outcome = resolveTelegramOutcome({ providerId: '1' }, undefined)
  expect(outcome).toEqual({ kind: 'retry-with-phone' })
})

test('a phone on the second pass completes the link', () => {
  const outcome = resolveTelegramOutcome({ providerId: '1', phone: '+359888123456' }, 'phone')
  expect(outcome).toEqual({ kind: 'link', identity: { providerId: '1', phone: '+359888123456' } })
})

test('nothing on the second pass is an explained failure', () => {
  const outcome = resolveTelegramOutcome({ providerId: '1' }, 'phone')
  expect(outcome.kind).toBe('failed')
  if (outcome.kind === 'failed') expect(outcome.message).toMatch(/username|phone/i)
})
