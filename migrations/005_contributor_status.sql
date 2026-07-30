-- Owned by cf-internal's pass/contributors.yaml, not by this app's own UI —
-- a contributor never sets their own status; an admin promotes it by editing
-- the registry file, which syncs here via /internal/contributors/sync.
-- 'draft' is the only value a contributor can reach on their own, the moment
-- they sign in with GitHub.
ALTER TABLE contributors
  ADD COLUMN status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed'));
