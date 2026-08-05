-- IDEA-012. `blocked` is set by an Admin (Confirm/Block on /admin), not
-- via the registry file the way draft/confirmed's own transitions normally
-- are — see contributors.ts's setContributorStatus. A blocked contributor
-- is hidden the same way a draft one already is (search, public profile —
-- both already gate on status = 'confirmed'), not additionally restricted
-- from signing in or editing their own profile.
ALTER TABLE contributors
  DROP CONSTRAINT contributors_status_check,
  ADD CONSTRAINT contributors_status_check CHECK (status IN ('draft', 'confirmed', 'blocked'));
