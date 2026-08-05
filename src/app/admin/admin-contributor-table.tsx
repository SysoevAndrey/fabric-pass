'use client'

import { useMemo, useState } from 'react'
import type { ContributorStatus } from '@/lib/contributors'
import { setContributorStatusAction } from './actions'

interface AdminContributorRow {
  githubId: string
  githubLogin: string
  name: string | null
  email: string | null
  company: string | null
  status: ContributorStatus
}

/**
 * IDEA-012's "same search as IDEA-005" — adapted, not reused directly: that
 * search is confirmed-only and server-side, deliberately, since Main never
 * has the whole contributor list in hand. This page already does (every
 * status, fetched once by the server component above), so filtering it
 * client-side against what's already loaded is both simpler and more
 * useful here — an admin filtering for a `draft` signup to Confirm would
 * find nothing through IDEA-005's own confirmed-only search.
 */
export function AdminContributorTable({ contributors }: { contributors: AdminContributorRow[] }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState(contributors)
  const [pendingGithubId, setPendingGithubId] = useState<string>()
  const [message, setMessage] = useState<string>()

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return rows
    return rows.filter((row) =>
      [row.githubLogin, row.name, row.email, row.status].some((field) => field?.toLowerCase().includes(trimmed)),
    )
  }, [rows, query])

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
      <input
        type="text"
        placeholder="Filter by name, email, username, or status…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {message ? (
        <p className="error" role="alert">
          {message}
        </p>
      ) : null}
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>GitHub</th>
              <th>Name</th>
              <th>Email</th>
              <th>Company</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.githubId}>
                <td>@{row.githubLogin}</td>
                <td>{row.name ?? '—'}</td>
                <td>{row.email ?? '—'}</td>
                <td>{row.company ?? '—'}</td>
                <td>
                  <span className={`admin-status admin-status-${row.status}`}>{row.status}</span>
                </td>
                <td className="admin-actions">
                  <button
                    type="button"
                    disabled={pendingGithubId === row.githubId}
                    onClick={() => setStatus(row.githubId, 'confirmed')}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    disabled={pendingGithubId === row.githubId}
                    onClick={() => setStatus(row.githubId, 'blocked')}
                  >
                    Block
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
