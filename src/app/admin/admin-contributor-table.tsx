'use client'

import { useMemo, useState } from 'react'
import type { ContributorStatus } from '@/lib/contributors'
import { PROFILE_COMPLETENESS_LABELS, PROFILE_COMPLETENESS_VALUES, type ProfileCompleteness } from '@/lib/profile-completeness'
import { setContributorStatusAction } from './actions'

interface AdminContributorRow {
  githubId: string
  githubLogin: string
  name: string | null
  email: string | null
  company: string | null
  status: ContributorStatus
  profileCompleteness: ProfileCompleteness
}

// Duplicated from contributors.ts's CONTRIBUTOR_STATUSES rather than
// imported — that module pulls in `pg` (via lib/db), which must never reach
// this 'use client' component's browser bundle (the type-only import above
// is erased at compile time and stays safe; a value import of the same
// constant would not be).
const CONTRIBUTOR_STATUS_VALUES = ['draft', 'confirmed', 'blocked'] as const
const STATUS_FILTER_OPTIONS = ['all', ...CONTRIBUTOR_STATUS_VALUES] as const
type StatusFilter = (typeof STATUS_FILTER_OPTIONS)[number]

const COMPLETENESS_FILTER_OPTIONS = ['all', ...PROFILE_COMPLETENESS_VALUES] as const
type CompletenessFilter = (typeof COMPLETENESS_FILTER_OPTIONS)[number]

/**
 * IDEA-012's "same search as IDEA-005" — adapted, not reused directly: that
 * search is confirmed-only and server-side, deliberately, since Main never
 * has the whole contributor list in hand. This page already does (every
 * status, fetched once by the server component above), so filtering it
 * client-side against what's already loaded is both simpler and more
 * useful here — an admin filtering for a `draft` signup to Confirm would
 * find nothing through IDEA-005's own confirmed-only search.
 *
 * IDEA-036 added the status/completeness dropdowns and the tile layout
 * below, replacing the table (IDEA-012's original shape) that needed
 * horizontal scroll to see every column at once.
 */
export function AdminContributorTable({ contributors }: { contributors: AdminContributorRow[] }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilter>('all')
  const [rows, setRows] = useState(contributors)
  const [pendingGithubId, setPendingGithubId] = useState<string>()
  const [message, setMessage] = useState<string>()

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (completenessFilter !== 'all' && row.profileCompleteness !== completenessFilter) return false
      if (!trimmed) return true
      return [row.githubLogin, row.name, row.email, row.status].some((field) => field?.toLowerCase().includes(trimmed))
    })
  }, [rows, query, statusFilter, completenessFilter])

  async function setStatus(githubId: string, status: 'confirmed' | 'blocked') {
    setPendingGithubId(githubId)
    setMessage(undefined)
    const result = await setContributorStatusAction(githubId, status)
    setPendingGithubId(undefined)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setRows((current) => current.map((row) => (row.githubId === githubId ? { ...row, status } : row)))
  }

  return (
    <>
      <div className="admin-filters">
        <input
          type="text"
          placeholder="Filter by name, email, username, or status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="all">Every status</option>
          {CONTRIBUTOR_STATUS_VALUES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select value={completenessFilter} onChange={(e) => setCompletenessFilter(e.target.value as CompletenessFilter)}>
          <option value="all">Every completeness</option>
          {PROFILE_COMPLETENESS_VALUES.map((value) => (
            <option key={value} value={value}>
              {PROFILE_COMPLETENESS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      {message ? (
        <p className="error" role="alert">
          {message}
        </p>
      ) : null}
      <div className="admin-tiles">
        {filtered.map((row) => (
          <div className="admin-tile" key={row.githubId}>
            <div className="admin-tile-header">
              <span className="admin-tile-login">@{row.githubLogin}</span>
              <span className={`admin-status admin-status-${row.status}`}>{row.status}</span>
            </div>
            <div className="admin-tile-name">{row.name ?? '—'}</div>
            <div className="admin-tile-field">{row.email ?? '—'}</div>
            <div className="admin-tile-field">{row.company ?? '—'}</div>
            <span className={`completeness-badge completeness-badge-${row.profileCompleteness}`}>
              {PROFILE_COMPLETENESS_LABELS[row.profileCompleteness]}
            </span>
            <div className="admin-actions">
              <button
                type="button"
                disabled={pendingGithubId === row.githubId || row.status === 'confirmed'}
                onClick={() => setStatus(row.githubId, 'confirmed')}
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={pendingGithubId === row.githubId || row.status === 'blocked'}
                onClick={() => setStatus(row.githubId, 'blocked')}
              >
                Block
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
