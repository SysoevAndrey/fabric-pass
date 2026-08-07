-- IDEA-027/028. Singleton row (same `id boolean` pattern as
-- track_page_template, migrations/014) caching the production droplet's
-- last-fetched operational status, so the footer (Admin-only, IDEA-028)
-- reads a cached snapshot on every render instead of calling DigitalOcean's
-- API live on every page load. Refreshed on read, not on a schedule — see
-- droplet-metrics.ts's getDropletMetrics, which re-fetches only once the
-- cached row is older than its own TTL.
--
-- disk_io_bytes_per_sec is combined read+write throughput, not a
-- percentage — DigitalOcean's API has no natural 0-100 denominator for
-- disk I/O the way it does for CPU/RAM/disk-space utilization (see
-- droplet-metrics.ts's module doc for the color-threshold approximation
-- built on top of this raw number).
CREATE TABLE droplet_metrics (
  id                    boolean PRIMARY KEY DEFAULT true CHECK (id),
  cpu_percent           double precision,
  ram_percent           double precision,
  disk_percent          double precision,
  disk_io_bytes_per_sec double precision,
  updated_at            timestamptz NOT NULL DEFAULT now()
);
