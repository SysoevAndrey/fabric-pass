'use client'

import { useEffect, useRef, useState } from 'react'

/** "Ada Lovelace" → "AL"; a single word (a github login, or a one-word name)
 * takes its first two characters instead. */
function initials(value: string): string {
  const words = value.trim().split(/\s+/)
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase()
  return value.slice(0, 2).toUpperCase()
}

export function UserMenu({
  login,
  name,
  isAdmin,
  isTrackAdmin,
}: {
  login: string
  name: string | null
  isAdmin: boolean
  isTrackAdmin: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Closes on any click outside the menu, including the trigger itself
  // toggling back closed on its own second click before this ever fires.
  useEffect(() => {
    if (!open) return
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onClickOutside)
    return () => document.removeEventListener('click', onClickOutside)
  }, [open])

  const displayName = name || `@${login}`

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
      >
        {initials(name || login)}
      </button>
      {open ? (
        <div className="user-menu-dropdown" role="menu">
          <p className="user-menu-name" role="menuitem">
            {displayName}
          </p>
          <a className="user-menu-item" href="/profile" role="menuitem">
            Profile
          </a>
          {isTrackAdmin ? (
            <a className="user-menu-item" href="/tracks/admin" role="menuitem">
              Track membership
            </a>
          ) : null}
          {isAdmin ? (
            <a className="user-menu-item" href="/admin" role="menuitem">
              Admin
            </a>
          ) : null}
          {isAdmin ? (
            <a className="user-menu-item" href="/admin/audit-log" role="menuitem">
              Audit log
            </a>
          ) : null}
          <a className="user-menu-item" href="/auth/sign-out" role="menuitem">
            Sign Out
          </a>
        </div>
      ) : null}
    </div>
  )
}
