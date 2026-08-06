-- IDEA-034. Derived, not self-reported — recomputed by the app (see
-- contributors.ts's refreshProfileCompleteness) after any write that could
-- change it, not something anyone hand-edits. Stored (rather than computed
-- on every read) so it can be exported to pass/contributors.yaml for
-- visibility and filtered on directly from the Admin page (IDEA-036),
-- the same reasoning as `status`.
ALTER TABLE contributors
  ADD COLUMN profile_completeness text NOT NULL DEFAULT 'incomplete'
    CHECK (profile_completeness IN ('incomplete', 'ready', 'complete'));

-- Backfill from what's already on file, so the column reflects reality
-- immediately rather than only for future writes. Requires LinkedIn linked
-- for 'complete' — correct for a deploy where LinkedIn is configured (this
-- app's current state); a deploy that never enabled it would have no
-- contributor with linkedin_name set anyway, so existing rows there would
-- undercount as 'ready' until next touched (see refreshProfileCompleteness,
-- which is linkedinEnabled-aware) — an accepted, self-correcting gap for a
-- one-time backfill.
UPDATE contributors SET profile_completeness = CASE
  WHEN name IS NOT NULL AND email IS NOT NULL AND company IS NOT NULL AND discord_username IS NOT NULL
       AND email_confirmed_at IS NOT NULL
       AND (telegram_username IS NOT NULL OR telegram_phone IS NOT NULL)
       AND linkedin_name IS NOT NULL
    THEN 'complete'
  WHEN name IS NOT NULL AND email IS NOT NULL AND company IS NOT NULL AND discord_username IS NOT NULL
       AND email_confirmed_at IS NOT NULL
    THEN 'ready'
  ELSE 'incomplete'
END;
