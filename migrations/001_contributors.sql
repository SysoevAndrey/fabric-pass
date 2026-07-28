CREATE TABLE contributors (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id         bigint      NOT NULL UNIQUE,
  github_login      text        NOT NULL,
  telegram_id       bigint      UNIQUE,
  telegram_username text,
  telegram_phone    text,
  discord_id        text        UNIQUE,
  discord_username  text,
  first_name        text        NOT NULL,
  last_name         text        NOT NULL,
  email             text        NOT NULL,
  company           text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
