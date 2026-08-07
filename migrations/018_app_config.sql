-- IDEA-040. Singleton row (same `id boolean` pattern as track_page_template,
-- migrations/014), entirely owned by pass/config.yaml in cf-internal,
-- synced one-way via POST /internal/config/sync — the small set of
-- deploy-wide values IDEA-041/042 need but that shouldn't be hardcoded or
-- require an SSH session + redeploy to change, the same "easy to maintain
-- for Track Admins and Org Admins" reasoning already established for
-- tracks.yaml/artifact-links.yaml.
CREATE TABLE app_config (
  id                 boolean PRIMARY KEY DEFAULT true CHECK (id),
  github_organization text,
  discord_guild_id    text,
  discord_invite_url  text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
