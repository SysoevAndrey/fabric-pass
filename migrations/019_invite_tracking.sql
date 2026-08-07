-- IDEA-041. Tracks the last time this app attempted to invite a confirmed
-- contributor to the GitHub org / send them the Discord server invite —
-- stamped on attempt, not just success, so the Admin list's "Re-invite"
-- cooldown (15 minutes) can't be bypassed by a run of failed attempts.
-- Nullable: never invited yet.
ALTER TABLE contributors
  ADD COLUMN github_org_invited_at timestamptz,
  ADD COLUMN discord_invited_at    timestamptz;
