'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { searchContributorsAction } from './actions'
import { CONTRIBUTOR_STATUS_LABELS } from '@/lib/contributor-status-labels'
import type { ContributorSearchResult } from '@/lib/contributors'
import { StatusMark } from './marks'

/** Snappier than autosave's 600ms debounce (use-autosave-field.ts) — this is
 * read-as-you-type feedback, not a write that needs to avoid firing on
 * every keystroke for its own sake. */
const DEBOUNCE_MS = 250
const MIN_QUERY_LENGTH = 3

export function ContributorSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContributorSearchResult[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Guards against a slower, earlier search's response landing after a
  // faster, later one and clobbering it with stale results — the same class
  // of race use-autosave-field.ts's SaveQueue exists to prevent, just for a
  // read instead of a write.
  const latestQuery = useRef('')

  useEffect(() => {
    clearTimeout(timer.current)
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([])
      return
    }
    timer.current = setTimeout(() => {
      latestQuery.current = trimmed
      searchContributorsAction(trimmed).then((found) => {
        if (latestQuery.current === trimmed) setResults(found)
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer.current)
  }, [query])

  return (
    <div className="contributor-search">
      <label htmlFor="contributor-search">Find a contributor</label>
      <input
        id="contributor-search"
        type="text"
        placeholder="Search by name, email, or username…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {results.length > 0 ? (
        <ul className="search-results">
          {results.map((result) => (
            <li key={result.hash}>
              <Link href={`/contributors/${result.hash}`} className="search-result-link">
                <span>
                  {result.name}
                  {result.company ? <span className="search-result-company"> · {result.company}</span> : null}
                </span>
                {/* IDEA-038 item 2 — searchContributors only ever returns
                    `confirmed` contributors (see its own doc comment), so
                    this is always the same value; shown anyway for
                    badge-shape consistency with the Admin table and public
                    profile. */}
                <span className="admin-status admin-status-confirmed">
                  <StatusMark size={12} />
                  {CONTRIBUTOR_STATUS_LABELS.confirmed}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : query.trim().length >= MIN_QUERY_LENGTH ? (
        <p className="search-empty">No matches.</p>
      ) : null}
    </div>
  )
}
