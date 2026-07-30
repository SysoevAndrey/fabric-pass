-- Name/email as each provider's own public profile states them, distinct
-- from the name/email/company the contributor types directly (which these
-- never overwrite). GitHub's email is specifically whichever one the
-- contributor has chosen to make public on their profile — often null, by
-- their own privacy choice, not a gap in what's asked for. Discord and
-- Telegram have no email in their public profile at all, and no provider
-- here exposes a phone number outside Telegram's existing no-username path.
ALTER TABLE contributors
  ADD COLUMN github_name    text,
  ADD COLUMN github_email   text,
  ADD COLUMN discord_name   text,
  ADD COLUMN telegram_name  text;
