import { expect, test } from 'vitest'
import { SaveSequence } from './save-sequence.ts'

test('a freshly issued save is current', () => {
  const sequence = new SaveSequence()
  const seq = sequence.issue()
  expect(sequence.isCurrent(seq)).toBe(true)
})

// The exact defect this exists to catch: type "Jo" (slow request issued
// first), then type on to "John" (fast request issued second) — the second
// request landing first must not make the first one's later arrival look
// current.
test('an earlier-issued save is stale once a later one has been issued, regardless of which resolves first', () => {
  const sequence = new SaveSequence()
  const slowJo = sequence.issue()
  const fastJohn = sequence.issue()

  expect(sequence.isCurrent(fastJohn)).toBe(true)
  expect(sequence.isCurrent(slowJo)).toBe(false)
})

test('checking a stale save does not disturb which one is current', () => {
  const sequence = new SaveSequence()
  const first = sequence.issue()
  const second = sequence.issue()

  expect(sequence.isCurrent(first)).toBe(false)
  expect(sequence.isCurrent(second)).toBe(true)
})

test('a third save issued later supersedes both of the first two', () => {
  const sequence = new SaveSequence()
  const first = sequence.issue()
  const second = sequence.issue()
  const third = sequence.issue()

  expect(sequence.isCurrent(first)).toBe(false)
  expect(sequence.isCurrent(second)).toBe(false)
  expect(sequence.isCurrent(third)).toBe(true)
})
