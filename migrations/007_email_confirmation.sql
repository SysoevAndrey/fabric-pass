-- email_confirmed_at is owned by this app (like email itself), never by the
-- registry file — see contributors-registry.ts's module doc. The token is
-- deliberately never exported anywhere: it's a bearer credential, and the
-- only thing standing between "click this link" and confirming someone
-- else's email.
ALTER TABLE contributors
  ADD COLUMN email_confirmed_at         timestamptz,
  ADD COLUMN email_confirmation_token   text UNIQUE,
  ADD COLUMN email_confirmation_sent_at timestamptz;
