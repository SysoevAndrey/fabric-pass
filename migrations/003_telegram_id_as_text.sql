-- Telegram's OIDC `sub` is a string and is not bounded by 64 bits — production
-- saw "12183332595470058690" (20 digits, past bigint's ~9.2e18 max) rejected
-- as "value ... is out of range for type bigint" on a callback that had
-- already succeeded with Telegram, so the person's login was thrown away.
-- discord_id is already `text` for the same shape of id (a snowflake);
-- telegram_id was the odd one out. `USING telegram_id::text` carries every
-- existing value across unchanged — a bigint always prints as its own digits.
ALTER TABLE contributors ALTER COLUMN telegram_id TYPE text USING telegram_id::text;
