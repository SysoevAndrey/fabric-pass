-- Owned by cf-internal's pass/contributors.yaml, same as status/is_agent —
-- a contributor never grants this to themselves. isRootUser (lib/root-user.ts)
-- is the separate, env-configured bootstrap admin; this is everyone else.
ALTER TABLE contributors
  ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
