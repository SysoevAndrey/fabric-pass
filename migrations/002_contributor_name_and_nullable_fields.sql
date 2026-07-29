-- Autosave means a row exists from the moment of GitHub sign-in, long before
-- a contributor has typed anything — so name and email can no longer be
-- NOT NULL. Name also replaces the separate first_name/last_name pair with
-- one field, carrying the existing row's two names into it before the old
-- columns go away.
ALTER TABLE contributors ADD COLUMN name text;

UPDATE contributors
   SET name = NULLIF(trim(concat_ws(' ', first_name, last_name)), '');

ALTER TABLE contributors
  DROP COLUMN first_name,
  DROP COLUMN last_name,
  ALTER COLUMN email DROP NOT NULL;
