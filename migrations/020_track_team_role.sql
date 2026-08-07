-- IDEA-042. Two optional per-track fields, synced from pass/tracks.yaml
-- alongside everything else a track already carries — a track with neither
-- set simply never triggers a GitHub-team or Discord-role grant on
-- approval (see track-members.ts's decideJoinRequest caller in
-- tracks/admin/actions.ts).
ALTER TABLE tracks
  ADD COLUMN github_team     text,
  ADD COLUMN discord_role_id text;

-- Mirrors contributors' github_org_invited_at/discord_invited_at
-- (migrations/019) at the per-track-membership level — stamped on
-- attempt, backing the same 15-minute Re-add cooldown on IDEA-014's
-- member list.
ALTER TABLE track_members
  ADD COLUMN github_team_added_at   timestamptz,
  ADD COLUMN discord_role_added_at  timestamptz;
