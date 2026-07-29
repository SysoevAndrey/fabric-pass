import { expect, test } from 'vitest'
import { SaveQueue } from './save-queue.ts'

test('a value that differs from what is confirmed is sent right away', () => {
  const queue = new SaveQueue('')
  expect(queue.request('Jo')).toBe(true)
})

test('a value matching what is already confirmed is not sent again', () => {
  const queue = new SaveQueue('Jo')
  expect(queue.request('Jo')).toBe(false)
})

// The exact defect this exists to catch: type "Jo" (a slow request goes
// out), then type on to "John" (a fast request would otherwise go out
// immediately and could land first, leaving the database holding "Jo").
// Serializing means the second request is never sent while the first is
// still in flight — it becomes the pending value instead.
test('a second request for the same field while one is in flight is queued, not sent', () => {
  const queue = new SaveQueue('')
  const slowJo = queue.request('Jo')
  const fastJohn = queue.request('John')

  expect(slowJo).toBe(true)
  expect(fastJohn).toBe(false)
})

test('the slow request settling first hands the queue straight to the newer pending value, and confirms the older one only in passing', () => {
  const queue = new SaveQueue('')
  queue.request('Jo')
  queue.request('John')

  const afterJoSettles = queue.settle('Jo', true)

  // Jo did persist, but John is queued right behind it — the caller must
  // send John immediately, not report the field as saved yet.
  expect(afterJoSettles).toBe('John')
  expect(queue.confirmedValue).toBe('Jo')
})

test('the last value typed ends up the last value confirmed, and nothing is left pending once it settles', () => {
  const queue = new SaveQueue('')
  queue.request('Jo')
  queue.request('John')
  queue.settle('Jo', true)

  const afterJohnSettles = queue.settle('John', true)

  // Only now — once the value the contributor actually left in the field
  // has settled — may the caller claim the field is saved.
  expect(afterJohnSettles).toBeUndefined()
  expect(queue.confirmedValue).toBe('John')
})

test('a failed slow request does not block the newer pending value from still being sent', () => {
  const queue = new SaveQueue('')
  queue.request('Jo')
  queue.request('John')

  const afterJoFails = queue.settle('Jo', false)

  expect(afterJoFails).toBe('John')
  expect(queue.confirmedValue).toBe('')
})

test('a pending value that turns out to match what just settled is not resent', () => {
  const queue = new SaveQueue('')
  queue.request('Jo')
  queue.request('Jo') // retyped back to the in-flight value before it settles

  const afterJoSettles = queue.settle('Jo', true)

  expect(afterJoSettles).toBeUndefined()
  expect(queue.confirmedValue).toBe('Jo')
})

test('two fields do not serialize against each other', () => {
  const nameQueue = new SaveQueue('')
  const emailQueue = new SaveQueue('')

  const nameSent = nameQueue.request('Ada')
  const emailSent = emailQueue.request('ada@example.com')

  // A slow save in flight for one field must not queue up a save for a
  // different field — each field gets its own queue instance and neither
  // is aware the other exists.
  expect(nameSent).toBe(true)
  expect(emailSent).toBe(true)

  const nameNext = nameQueue.settle('Ada', true)
  const emailNext = emailQueue.settle('ada@example.com', true)

  expect(nameNext).toBeUndefined()
  expect(emailNext).toBeUndefined()
  expect(nameQueue.confirmedValue).toBe('Ada')
  expect(emailQueue.confirmedValue).toBe('ada@example.com')
})
