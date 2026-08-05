-- IDEA-010. Entirely owned by cf-internal's pass/tracks.yaml — unlike
-- contributors, nothing about a track is self-reported by any one person,
-- so unlike pass/contributors.yaml this sync is one-way (file -> DB only);
-- there is nothing here for this app to export back.
--
-- `github_id` columns are bigint, matching contributors.github_id itself
-- (never converted to text the way telegram_id/discord_id/linkedin_id were —
-- GitHub's own numeric ids are nowhere near bigint's ceiling).
--
-- repositories is jsonb, not a child table: always read and written as one
-- small, admin-curated list, never queried by individual repository.
CREATE TABLE tracks (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                      text NOT NULL UNIQUE,
  name                      text NOT NULL,
  description               text,
  repositories              jsonb NOT NULL DEFAULT '[]',
  product_manager_github_id bigint REFERENCES contributors (github_id),
  architect_github_id       bigint REFERENCES contributors (github_id),
  developer_github_id       bigint REFERENCES contributors (github_id),
  quality_github_id         bigint REFERENCES contributors (github_id),
  researcher_github_id      bigint REFERENCES contributors (github_id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- Deliberately its own table, not another column on tracks: a track's
-- Product Manager (above, for display on the track directory) and its Track
-- Admin (permission to manage that track's membership, IDEA-014) are
-- different concepts that will often overlap but aren't the same grant.
-- Many-to-many on purpose — a contributor can admin more than one track, and
-- a track can have more than one admin.
CREATE TABLE track_admins (
  track_id  uuid   NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  github_id bigint NOT NULL REFERENCES contributors (github_id),
  PRIMARY KEY (track_id, github_id)
);
