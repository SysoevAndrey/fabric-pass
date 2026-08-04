-- text from the start, unlike discord_id/github_id's original bigint —
-- migrations/003_telegram_id_as_text.sql already hit a real production id
-- past bigint's ~9.2e18 ceiling once; no reason to risk the same failure a
-- second time for a provider whose id format this app has never observed.
--
-- No linkedin_username: unlike Discord/Telegram, LinkedIn's OpenID Connect
-- payload carries no username or vanity-URL claim (see
-- lib/providers/linkedin.ts) — linkedin_name is the only label there is.
ALTER TABLE contributors
  ADD COLUMN linkedin_id   text UNIQUE,
  ADD COLUMN linkedin_name text;
