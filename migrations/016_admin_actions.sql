-- IDEA-022. Every action an Admin or Track Admin takes through the app —
-- Confirm/Block (IDEA-012), Accept/Reject (IDEA-014) — not the
-- registry-file-driven changes that already have their own audit trail via
-- git history (see the idea's own notes).
--
-- target_github_id and track_id are both nullable and independent, not a
-- discriminated union in SQL: a Confirm/Block names a target contributor
-- but no track; an Accept/Reject names both (the requester, and the track
-- they requested). `details` carries whatever's specific to the action
-- type (e.g. the decision made) rather than adding a column per action.
CREATE TABLE admin_actions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_github_id  bigint NOT NULL REFERENCES contributors (github_id),
  action           text   NOT NULL,
  target_github_id bigint REFERENCES contributors (github_id),
  track_id         uuid   REFERENCES tracks (id),
  details          jsonb  NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_actions_created_at_idx ON admin_actions (created_at DESC);
