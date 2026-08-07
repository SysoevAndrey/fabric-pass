-- IDEA-032. Entirely owned by cf-internal's pass/artifact-links.yaml — one-way
-- sync (file -> DB only), same reasoning as tracks (migrations/010_tracks.sql):
-- nothing here is self-reported by any one contributor, so there's no export
-- direction. Full-replace on every sync (delete all, insert the file's set)
-- rather than upsert-by-key — there's no natural unique key across
-- scope/category/label worth building matching logic around for something
-- this small and infrequently-changed.
--
-- `scope` is either the literal 'community' or a track's slug — not a
-- foreign key, since 'community' doesn't name a row in `tracks`. Validated
-- in application code at sync time instead (src/lib/artifact-links.ts),
-- the same skip-and-log treatment tracks.ts already gives an unrecognized
-- leader/admin login.
CREATE TABLE artifact_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope      text NOT NULL,
  category   text NOT NULL CHECK (category IN ('policy', 'vision', 'roadmap', 'schedule', 'discord', 'guide', 'other')),
  label      text NOT NULL,
  url        text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX artifact_links_scope_idx ON artifact_links (scope);
