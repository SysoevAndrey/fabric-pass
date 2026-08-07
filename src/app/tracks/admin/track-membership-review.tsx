'use client'

import { useMemo, useState } from 'react'
import { decideJoinRequestAction } from './actions'

interface MemberRow {
  githubId: string
  githubLogin: string
  name?: string
  status: 'pending' | 'approved' | 'rejected'
}

interface Section {
  trackSlug: string
  trackName: string
  members: MemberRow[]
}

/**
 * IDEA-014 — one section per track the caller administers (or every track,
 * for a global Admin — see page.tsx), each split into that track's pending
 * requests (Accept/Reject) and its current members (read-only here — IDEA-017
 * covers self-service leaving, not a Track Admin removing someone).
 * Search reuses the same client-side-filter-what's-already-loaded pattern as
 * IDEA-012's Admin table (admin-contributor-table.tsx), adapted: this page
 * loads every track it's allowed to show up front, so filtering it in the
 * browser is simpler than round-tripping per keystroke — same reasoning
 * admin-contributor-table.tsx's own doc comment gives for the same choice.
 */
export function TrackMembershipReview({ sections: initialSections }: { sections: Section[] }) {
  const [sections, setSections] = useState(initialSections)
  const [query, setQuery] = useState('')
  const [pendingKey, setPendingKey] = useState<string>()
  const [message, setMessage] = useState<string>()

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return sections
    return sections
      .map((section) => ({
        ...section,
        members: section.members.filter((member) =>
          [member.githubLogin, member.name].some((field) => field?.toLowerCase().includes(trimmed)),
        ),
      }))
      .filter((section) => section.members.length > 0)
  }, [sections, query])

  async function decide(trackSlug: string, githubId: string, decision: 'approved' | 'rejected') {
    const key = `${trackSlug}/${githubId}`
    setPendingKey(key)
    setMessage(undefined)
    const result = await decideJoinRequestAction(trackSlug, githubId, decision)
    setPendingKey(undefined)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setSections((current) =>
      current.map((section) =>
        section.trackSlug !== trackSlug
          ? section
          : { ...section, members: section.members.map((m) => (m.githubId === githubId ? { ...m, status: decision } : m)) },
      ),
    )
  }

  return (
    <>
      <div className="admin-filters">
        <input
          type="text"
          placeholder="Filter by name or username…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      {message ? (
        <p className="error" role="alert">
          {message}
        </p>
      ) : null}
      {filtered.map((section) => {
        const pending = section.members.filter((m) => m.status === 'pending')
        const approved = section.members.filter((m) => m.status === 'approved')
        if (pending.length === 0 && approved.length === 0) return null

        return (
          <section key={section.trackSlug} className="track-review-section">
            <h3>{section.trackName}</h3>

            {pending.length > 0 ? (
              <>
                <p className="subtitle">Pending requests</p>
                <div className="admin-tiles">
                  {pending.map((member) => (
                    <div className="admin-tile" key={member.githubId}>
                      <div className="admin-tile-header">
                        <h3 className="admin-tile-name">{member.name ?? `@${member.githubLogin}`}</h3>
                      </div>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="button-primary"
                          disabled={pendingKey === `${section.trackSlug}/${member.githubId}`}
                          onClick={() => decide(section.trackSlug, member.githubId, 'approved')}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="button-secondary"
                          disabled={pendingKey === `${section.trackSlug}/${member.githubId}`}
                          onClick={() => decide(section.trackSlug, member.githubId, 'rejected')}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {approved.length > 0 ? (
              <>
                <p className="subtitle">Members</p>
                <ul className="track-member-list">
                  {approved.map((member) => (
                    <li key={member.githubId}>{member.name ?? `@${member.githubLogin}`}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        )
      })}
    </>
  )
}
