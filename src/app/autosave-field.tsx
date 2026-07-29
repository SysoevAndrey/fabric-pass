'use client'

import { useRef } from 'react'
import { useAutosaveField, type AutosaveStatus } from '@/app/use-autosave-field'
import type { DetailField } from '@/lib/contributors'

/** The only feedback a contributor gets that a keystroke was actually kept —
 * there is no Save button any more, so this is where "was that stored?" gets
 * answered. `guidance` reads the same greyed-out, unhurried style as 'idle'
 * and 'saving' (never the red of 'error', never mistakable for 'saved') —
 * it's mid-typing progress, not a mistake. `reauthRequired` adds a link
 * straight back into GitHub sign-in right next to the error that caused it,
 * rather than leaving the contributor on a page with no way out (see
 * README's "session outlives its row"). */
function AutosaveStatusLabel({
  status,
  message,
  reauthRequired,
}: {
  status: AutosaveStatus
  message?: string
  reauthRequired?: boolean
}) {
  const text =
    status === 'saving'
      ? 'Saving…'
      : status === 'saved'
        ? 'Saved'
        : status === 'guidance'
          ? (message ?? '')
          : status === 'error'
            ? (message ?? 'Could not save')
            : ''
  return (
    <span className={`autosave-status ${status}`} aria-live="polite">
      {text}
      {reauthRequired ? (
        <>
          {' '}
          <a href="/auth/github">Sign in again</a>
        </>
      ) : null}
    </span>
  )
}

interface FieldProps {
  id: string
  field: DetailField
  label: string
  type?: string
  placeholder?: string
  defaultValue: string
}

export function AutosaveField({ id, field, label, type = 'text', placeholder, defaultValue }: FieldProps) {
  const { value, status, message, reauthRequired, onChange, onBlur } = useAutosaveField(field, defaultValue)

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={field}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      <AutosaveStatusLabel status={status} message={message} reauthRequired={reauthRequired} />
    </>
  )
}

/**
 * Company keeps the datalist-plus-clear-button UX from the earlier, Save-button
 * form: the three common answers as suggestions, but free text still works,
 * and unlike a <select> this degrades without JavaScript. Autosave only
 * changes how the value reaches the database, not this field's shape.
 */
export function CompanyField({ defaultValue }: { defaultValue: string }) {
  const { value, status, message, reauthRequired, onChange, onBlur, commit } = useAutosaveField('company', defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <label htmlFor="company">Company</label>
      <div className={value ? 'clearable filled' : 'clearable'}>
        <input
          id="company"
          name="company"
          // The datalist is what makes the browser draw its own dropdown
          // arrow, and no CSS hides that arrow across browsers. Dropping the
          // attribute once the field holds a value removes it outright; the
          // suggestions are there for an empty field, which is when they help.
          list={value ? undefined : 'companies'}
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        {value ? (
          <button
            type="button"
            className="clear"
            aria-label="Clear company"
            onClick={() => {
              commit('')
              inputRef.current?.focus()
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      <datalist id="companies">
        <option value="Constructor" />
        <option value="Acronis" />
        <option value="Virtuozzo" />
      </datalist>
      <AutosaveStatusLabel status={status} message={message} reauthRequired={reauthRequired} />
    </>
  )
}
