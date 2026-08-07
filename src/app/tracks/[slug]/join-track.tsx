'use client'

import { useState } from 'react'
import { StatusMark } from '@/app/marks'
import { requestToJoinTrackAction } from './actions'

type MembershipStatus = 'pending' | 'approved' | 'rejected' | null

const STATUS_LABELS: Record<Exclude<MembershipStatus, null>, string> = {
  pending: 'Pending review',
  approved: 'Member',
  rejected: 'Declined',
}

/**
 * IDEA-013's "Request to join" action, plus IDEA-019's in-app half of
 * telling the requester where their request stands — the email half is
 * sent when a Track Admin decides (see tracks/admin/actions.ts), this is
 * just what the requester sees on their own next visit to the page.
 */
export function JoinTrack({ trackSlug, initialStatus }: { trackSlug: string; initialStatus: MembershipStatus }) {
  const [status, setStatus] = useState(initialStatus)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string>()

  async function request() {
    setPending(true)
    setMessage(undefined)
    const result = await requestToJoinTrackAction(trackSlug)
    setPending(false)
    if (!result.ok) {
      setMessage(result.message)
      return
    }
    setStatus('pending')
  }

  return (
    <div className="track-membership">
      {status ? (
        <span className={`admin-status admin-status-${status}`}>
          <StatusMark size={13} />
          {STATUS_LABELS[status]}
        </span>
      ) : null}
      {message ? (
        <p className="error" role="alert">
          {message}
        </p>
      ) : null}
      {status === null || status === 'rejected' ? (
        <button type="button" className="button-primary" disabled={pending} onClick={request}>
          {status === 'rejected' ? 'Request again' : 'Request to join'}
        </button>
      ) : null}
    </div>
  )
}
