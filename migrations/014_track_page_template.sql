-- IDEA-035. A singleton row — one shared markdown template for every track's
-- page, not one per track (see pass/track-page.md's own doc). The
-- `id boolean PRIMARY KEY DEFAULT true CHECK (id)` trick caps the table at
-- exactly one row: `id` can only ever be `true`, and a primary key forbids a
-- second row with the same value.
--
-- Entirely owned by cf-internal's pass/track-page.md — one-way sync
-- (file -> DB only), same reasoning as tracks and artifact_links.
CREATE TABLE track_page_template (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  content    text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
