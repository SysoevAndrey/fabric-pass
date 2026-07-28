import { expect, test } from 'vitest'
import { isUnsaved } from './pending-link'

// Reproduces the second live-walkthrough defect: a contributor who links a
// provider after already saving has that identity in session.pending only —
// the database row is untouched until the next Save. These cases pin down
// exactly when the page should say "not yet saved".

test('no pending link at all is not unsaved — there is nothing to warn about', () => {
  expect(isUnsaved(undefined, undefined)).toBe(false)
  expect(isUnsaved(undefined, '123')).toBe(false)
})

test('a pending link with nothing stored yet is unsaved', () => {
  expect(isUnsaved({ providerId: '999', username: 'ada' }, undefined)).toBe(true)
})

test('a pending link matching what is already stored is not unsaved', () => {
  // This is the case right after a successful Save re-renders with the same
  // identity now also present in `existing` — session.pending would already
  // have been cleared by then, but the predicate itself must not flag a
  // pending value that already equals the stored one.
  expect(isUnsaved({ providerId: '999', username: 'ada' }, '999')).toBe(false)
})

test('a pending link for a different account than the one stored is unsaved', () => {
  // The exact defect: the contributor saved once, then re-linked a different
  // account before saving again — the stored row still names the old one.
  expect(isUnsaved({ providerId: '999', username: 'ada' }, '111')).toBe(true)
})
