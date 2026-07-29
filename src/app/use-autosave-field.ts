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
  const queue = useRef(new SaveQueue(initialValue)).current
  // Tracks which phase the *currently pending* value was requested under
  // (see flush's `phase` param): when a save settles and hands the queue
  // straight to a newer value (SaveQueue.settle's return), that chained send
  // needs the phase of whichever flush call queued it, not the phase of the
  // save that just finished. Every flush call — whether it sends right away
  // or ends up queued as pending — updates this, so it always reflects the
  // most recent one.
  const phaseRef = useRef<'typing' | 'final'>('final')

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
        send(pending, phaseRef.current)
      } else if (result.ok) {
        setStatus('saved')
        setMessage(undefined)
      }
    })
  }

  function flush(next: string, phase: 'typing' | 'final') {
    clearTimeout(timer.current)
    phaseRef.current = phase
    if (queue.request(next)) send(next, phase)
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
