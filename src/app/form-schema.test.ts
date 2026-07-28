import { expect, test } from 'vitest'
import { parseForm } from './form-schema.ts'

function form(fields: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

test('accepts a complete form', () => {
  const parsed = parseForm(
    form({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: 'Analytical Engines' }),
  )
  expect(parsed).toEqual({
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    company: 'Analytical Engines',
  })
})

test('treats a blank company as absent', () => {
  const parsed = parseForm(form({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', company: '  ' }))
  expect(parsed.company).toBeUndefined()
})

test('rejects a malformed email', () => {
  expect(() => parseForm(form({ firstName: 'Ada', lastName: 'Lovelace', email: 'not-an-email' }))).toThrow()
})

test('rejects a missing first name', () => {
  expect(() => parseForm(form({ lastName: 'Lovelace', email: 'ada@example.com' }))).toThrow()
})

test('trims surrounding whitespace', () => {
  const parsed = parseForm(form({ firstName: ' Ada ', lastName: ' Lovelace ', email: ' ada@example.com ' }))
  expect(parsed.firstName).toBe('Ada')
  expect(parsed.email).toBe('ada@example.com')
})
