'use client'

import { useEffect, useRef, useState } from 'react'
import { saveField } from '@/app/actions'
import type { DetailField } from '@/lib/contributors'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Long enough to not fire on every keystroke, short enough that "as they are
 * filled in" still feels immediate. */
const DEBOUNCE_MS = 600

/**
 * Drives one field's autosave: a debounced save on change, an immediate one
 * on blur or on an explicit `commit` (the company field's clear button uses
 * this — a deliberate one-shot action shouldn't wait out the debounce).
 * `lastSaved` skips a redundant network call when blur fires after the
 * debounced save already landed with the same value.
 */
export function useAutosaveField(field: DetailField, initialValue: string) {
  const [value, setValue] = useState(initialValue)
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [message, setMessage] = useState<string>()
  const lastSaved = useRef(initialValue)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function flush(next: string) {
    clearTimeout(timer.current)
    if (next === lastSaved.current) return
    setStatus('saving')
    saveField(field, next).then((result) => {
      if (result.ok) {
        lastSaved.current = next
        setStatus('saved')
        setMessage(undefined)
      } else {
        setStatus('error')
        setMessage(result.message)
      }
    })
  }

  function onChange(next: string) {
    setValue(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => flush(next), DEBOUNCE_MS)
  }

  function onBlur() {
    flush(value)
  }

  /** Sets and saves immediately, bypassing the debounce. */
  function commit(next: string) {
    setValue(next)
    flush(next)
  }

  return { value, status, message, onChange, onBlur, commit }
}
