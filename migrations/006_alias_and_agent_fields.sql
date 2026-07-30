-- Both owned by cf-internal's pass/contributors.yaml, same as `status` from
-- migrations/005_contributor_status.sql — an admin's judgment call, not
-- something a contributor sets about themselves via this app.
--
-- `bigint`, not `text`: unlike telegram_id (migrations/003), github_id was
-- never converted to text — GitHub's own numeric ids stay nowhere near
-- bigint's ~9.2e18 ceiling — and a foreign key requires matching types.
ALTER TABLE contributors
  ADD COLUMN alias_of_github_id bigint REFERENCES contributors (github_id),
  ADD COLUMN is_agent           boolean NOT NULL DEFAULT false;

-- An alias points at a *different* contributor's identity, never its own.
ALTER TABLE contributors
  ADD CONSTRAINT alias_of_not_self CHECK (alias_of_github_id IS NULL OR alias_of_github_id != github_id);
