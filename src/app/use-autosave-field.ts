'use client'

import { useEffect, useRef, useState } from 'react'
import { saveField } from '@/app/actions'
import { SaveQueue } from '@/app/save-queue'
import type { DetailField } from '@/lib/contributors'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'guidance'

/** Long enough to not fire on every keystroke, short enough that "as they are
 * filled in" still feels immediate. */
const DEBOUNCE_MS = 600

/**
 * Drives one field's autosave: a debounced save on change, an immediate one
 * on blur or on an explicit `commit` (the company field's clear button uses
 * this — a deliberate one-shot action shouldn't wait out the debounce).
 */
export function useAutosaveField(field: DetailField, initialValue: string) {
  const [value, setValue] = useState(initialValue)
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [message, setMessage] = useState<string>()
  const [reauthRequired, setReauthRequired] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // One queue per field instance (each field gets its own hook call, so its
  // own queue) serializes this field's saves: only one is ever in flight at
  // once, and a value typed while one is out becomes the next one sent, in
  // order. Without this, a fast later request can land before a slow
  // earlier one and the database ends up holding the earlier value while
  // "Saved" — the one feedback this no-button design has — claims otherwise.
  // The queue carries each value's phase alongside it (SaveQueue.settle
  // returns the pair together), so a chained send always re-sends with the
  // phase its value was actually queued under.
  const queue = useRef(new SaveQueue<'typing' | 'final'>(initialValue)).current

  useEffect(() => () => clearTimeout(timer.current), [])

  function send(next: string, phase: 'typing' | 'final') {
    setStatus('saving')
    saveField(field, next, phase).then((result) => {
      if (!result.ok) {
        setStatus(result.guidance ? 'guidance' : 'error')
        setMessage(result.message)
        setReauthRequired(Boolean(result.reauthRequired))
      } else {
        setReauthRequired(false)
      }
      const pending = queue.settle(next, result.ok)
      if (pending !== undefined) {
        send(pending.value, pending.phase)
      } else if (result.ok) {
        setStatus('saved')
        setMessage(undefined)
      }
    })
  }

  function flush(next: string, phase: 'typing' | 'final') {
    clearTimeout(timer.current)
    if (queue.request(next, phase)) send(next, phase)
  }

  function onChange(next: string) {
    setValue(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => flush(next, 'typing'), DEBOUNCE_MS)
  }

  function onBlur() {
    flush(value, 'final')
  }

  /** Sets and saves immediately, bypassing the debounce. */
  function commit(next: string) {
    setValue(next)
    flush(next, 'final')
  }

  return { value, status, message, reauthRequired, onChange, onBlur, commit }
}
