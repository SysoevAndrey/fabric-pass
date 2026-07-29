import { expect, test } from 'vitest'
import { validateField } from './form-schema.ts'

test('a name is trimmed and accepted as-is', () => {
  expect(validateField('name', '  Ada Lovelace  ')).toEqual({ ok: true, value: 'Ada Lovelace' })
})

test('a blank name clears the field rather than failing', () => {
  expect(validateField('name', '   ')).toEqual({ ok: true, value: undefined })
})

test('a company is trimmed and accepted as-is', () => {
  expect(validateField('company', '  Analytical Engines  ')).toEqual({ ok: true, value: 'Analytical Engines' })
})

test('a blank company clears the field rather than failing', () => {
  expect(validateField('company', '')).toEqual({ ok: true, value: undefined })
})

test('a valid email is trimmed and accepted', () => {
  expect(validateField('email', '  ada@example.com  ')).toEqual({ ok: true, value: 'ada@example.com' })
})

test('a blank email clears the field rather than failing', () => {
  expect(validateField('email', '  ')).toEqual({ ok: true, value: undefined })
})

test('a malformed email is rejected rather than saved as typed', () => {
  const result = validateField('email', 'not-an-email')
  expect(result.ok).toBe(false)
  expect(result.message).toMatch(/email/i)
})
