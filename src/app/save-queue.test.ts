import { expect, test } from 'vitest'
import { SaveQueue } from './save-queue.ts'

test('a value that differs from what is confirmed is sent right away', () => {
  const queue = new SaveQueue<'typing' | 'final'>('')
  expect(queue.request('Jo', 'final')).toBe(true)
})

test('a value matching what is already confirmed is not sent again', () => {
  const queue = new SaveQueue<'typing' | 'final'>('Jo')
  expect(queue.request('Jo', 'final')).toBe(false)
})

// The exact defect this exists to catch: type "Jo" (a slow request goes
// out), then type on to "John" (a fast request would otherwise go out
// immediately and could land first, leaving the database holding "Jo").
// Serializing means the second request is never sent while the first is
// still in flight — it becomes the pending value instead.
test('a second request for the same field while one is in flight is queued, not sent', () => {
  const queue = new SaveQueue<'typing' | 'final'>('')
  const slowJo = queue.request('Jo', 'final')
  const fastJohn = queue.request('John', 'final')

  expect(slowJo).toBe(true)
  expect(fastJohn).toBe(false)
})

test('the slow request settling first hands the queue straight to the newer pending value, and confirms the older one only in passing', () => {
  const queue = new SaveQueue<'typing' | 'final'>('')
  queue.request('Jo', 'final')
  queue.request('John', 'final')

  const afterJoSettles = queue.settle('Jo', true)

  // Jo did persist, but John is queued right behind it — the caller must
  // send John immediately, not report the field as saved yet.
  expect(afterJoSettles).toEqual({ value: 'John', phase: 'final' })
  expect(queue.confirmedValue).toBe('Jo')
})

test('the last value typed ends up the last value confirmed, and nothing is left pending once it settles', () => {
  const queue = new SaveQueue<'typing' | 'final'>('')
  queue.request('Jo', 'final')
  queue.request('John', 'final')
  queue.settle('Jo', true)

  const afterJohnSettles = queue.settle('John', true)

  // Only now — once the value the contributor actually left in the field
  // has settled — may the caller claim the field is saved.
  expect(afterJohnSettles).toBeUndefined()
  expect(queue.confirmedValue).toBe('John')
})

test('a failed slow request does not block the newer pending value from still being sent', () => {
  const queue = new SaveQueue<'typing' | 'final'>('')
  queue.request('Jo', 'final')
  queue.request('John', 'final')

  const afterJoFails = queue.settle('Jo', false)

  expect(afterJoFails).toEqual({ value: 'John', phase: 'final' })
  expect(queue.confirmedValue).toBe('')
})

test('a pending value that turns out to match what just settled is not resent', () => {
  const queue = new SaveQueue<'typing' | 'final'>('')
  queue.request('Jo', 'final')
  queue.request('Jo', 'final') // retyped back to the in-flight value before it settles

  const afterJoSettles = queue.settle('Jo', true)

  expect(afterJoSettles).toBeUndefined()
  expect(queue.confirmedValue).toBe('Jo')
})

test('two fields do not serialize against each other', () => {
  const nameQueue = new SaveQueue<'typing' | 'final'>('')
  const emailQueue = new SaveQueue<'typing' | 'final'>('')

  const nameSent = nameQueue.request('Ada', 'final')
  const emailSent = emailQueue.request('ada@example.com', 'final')

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

// The defect this pairing exists to catch: a chained send re-sending with
// the phase of whichever save just finished, instead of the phase the
// queued value was actually requested under. Because `settle` hands back
// the value and its phase as one pair, that mismatch is now structurally
// impossible — there is no separate phase field a caller could read stale.
test('a value queued while typing, then a blur before it settles, carries the blur\'s final phase forward', () => {
  const queue = new SaveQueue<'typing' | 'final'>('')
  queue.request('Jo', 'typing') // debounced save goes out while the field still has focus
  queue.request('John', 'final') // blur fires before it settles

  const next = queue.settle('Jo', true)

  expect(next).toEqual({ value: 'John', phase: 'final' })
})

test('a value queued on blur, then typing resumes before it settles, carries the newer typing phase forward', () => {
  const queue = new SaveQueue<'typing' | 'final'>('')
  queue.request('Jo', 'final') // blur fires first
  queue.request('John', 'typing') // the contributor keeps typing before it settles

  const next = queue.settle('Jo', true)

  expect(next).toEqual({ value: 'John', phase: 'typing' })
})
