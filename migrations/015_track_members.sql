-- IDEA-013/014/019. Unlike tracks/track_admins (admin-curated, synced from
-- cf-internal's pass/tracks.yaml), membership here is contributor-initiated
-- (request) and admin-decided (accept/reject) entirely in-app — the same
-- category of app-owned state as email confirmation or `status`, not
-- something pass/tracks.yaml has any business describing. No sync route.
--
-- One row per (track, contributor) by construction — a rejected request is
-- re-requested by resetting this same row back to 'pending' (see
-- track-members.ts's requestToJoinTrack), not by inserting a second one.
CREATE TABLE track_members (
  track_id             uuid   NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  github_id            bigint NOT NULL REFERENCES contributors (github_id),
  status               text   NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at         timestamptz NOT NULL DEFAULT now(),
  decided_at           timestamptz,
  decided_by_github_id bigint REFERENCES contributors (github_id),
  PRIMARY KEY (track_id, github_id)
);

CREATE INDEX track_members_status_idx ON track_members (track_id, status);
