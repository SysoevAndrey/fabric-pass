import { env } from '@/lib/env'
import { pool } from '@/lib/db'

/**
 * IDEA-027 — DigitalOcean's Monitoring API (v2/monitoring/metrics/droplet/*),
 * via a read-only DO API token. Optional, the same way RESEND_API_KEY is
 * (see env.ts): getDropletMetrics returns null with no error when
 * DO_API_TOKEN/DO_DROPLET_ID aren't set, and IDEA-028's footer simply
 * doesn't render its status section in that case.
 *
 * Response shape and the CPU-percent formula below are drawn from DO's own
 * documented API and a DO-staff-confirmed community answer (calculating
 * CPU usage from the monitoring API) — verified against DO's written
 * documentation, not against a live droplet with a real token (this
 * environment has none). Treat the exact numbers as a best-effort
 * implementation to sanity-check once DO_API_TOKEN is actually set, not as
 * numbers already proven correct against production.
 */
const DO_API_BASE = 'https://api.digitalocean.com/v2/monitoring/metrics/droplet'

/** How long a cached snapshot is served before the next read triggers a
 * fresh DO API call — this, not a cron schedule, is what makes the footer
 * "refreshed periodically rather than fetched live on every page load". */
const STALE_MS = 5 * 60 * 1000

interface DoMetricPoint {
  timestamp: number
  value: number
}

interface DoMetricSeries {
  metric: Record<string, string>
  values: DoMetricPoint[]
}

async function fetchDoMetric(metric: string, start: number, end: number): Promise<DoMetricSeries[]> {
  const url = `${DO_API_BASE}/${metric}?host_id=${env.DO_DROPLET_ID}&start=${start}&end=${end}`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${env.DO_API_TOKEN}` } })
  if (!response.ok) throw new Error(`DO API ${metric} responded ${response.status}`)
  const json = (await response.json()) as { data?: { result?: unknown } }
  const result = json.data?.result
  if (!Array.isArray(result)) throw new Error(`DO API ${metric} returned an unexpected shape`)
  return result.map((series) => {
    const s = series as { metric?: Record<string, string>; values?: [number, string][] }
    return {
      metric: s.metric ?? {},
      values: (s.values ?? []).map(([timestamp, value]) => ({ timestamp, value: Number(value) })),
    }
  })
}

/**
 * CPU's raw values are cumulative counters (seconds of CPU time per mode —
 * idle/user/system/etc.), not an instantaneous percentage — usage over a
 * window is the change in "busy" time divided by the change in total time
 * between the window's first and last sample, not a single point's ratio.
 */
export function computeCpuPercent(series: DoMetricSeries[]): number | null {
  const idleSeries = series.find((s) => s.metric.mode === 'idle')
  if (!idleSeries || idleSeries.values.length < 2) return null

  const lastIdx = idleSeries.values.length - 1
  const idleFirst = idleSeries.values[0].value
  const idleLast = idleSeries.values[lastIdx].value
  const totalFirst = series.reduce((sum, s) => sum + (s.values[0]?.value ?? 0), 0)
  const totalLast = series.reduce((sum, s) => sum + (s.values[lastIdx]?.value ?? 0), 0)

  const totalDiff = totalLast - totalFirst
  if (totalDiff <= 0) return null
  const idleDiff = idleLast - idleFirst
  return Math.max(0, Math.min(100, ((totalDiff - idleDiff) / totalDiff) * 100))
}

/** RAM is a gauge (a point-in-time reading), not a counter — "averaged over
 * the window" means the arithmetic mean of the samples themselves. */
export function averageSeriesValue(series: DoMetricSeries[]): number | null {
  const values = series.flatMap((s) => s.values.map((v) => v.value))
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Disk usage is read as a current snapshot, not averaged (IDEA-027's own
 * requirement — it moves slowly, so an hourly average would blur exactly
 * the moment a threshold is crossed). `filesystem` metrics report one
 * series per mounted filesystem; prefers the root mount when the response
 * labels it, falling back to whichever series came first otherwise. */
export function latestFilesystemValue(series: DoMetricSeries[]): number | null {
  const preferred = series.find((s) => s.metric.mountpoint === '/') ?? series[0]
  if (!preferred || preferred.values.length === 0) return null
  return preferred.values[preferred.values.length - 1].value
}

/** disk_read/disk_write are cumulative byte counters too — a rate (bytes
 * per second) is the change across the window's first and last sample
 * divided by the elapsed time, same shape as computeCpuPercent's diff. */
export function seriesRatePerSecond(series: DoMetricSeries[]): number | null {
  const values = series.flatMap((s) => s.values).sort((a, b) => a.timestamp - b.timestamp)
  if (values.length < 2) return null
  const first = values[0]
  const last = values[values.length - 1]
  const elapsed = last.timestamp - first.timestamp
  if (elapsed <= 0) return null
  return (last.value - first.value) / elapsed
}

export interface DropletMetrics {
  cpuPercent: number | null
  ramPercent: number | null
  diskPercent: number | null
  /** Combined read+write throughput — not a percentage. DigitalOcean's API
   * has no natural 0-100 denominator for disk I/O the way it does for
   * CPU/RAM/disk-space utilization; see droplet-status.tsx for the
   * (deliberately approximate, flagged-as-tunable) byte-rate thresholds
   * built on top of this raw number instead. */
  diskIoBytesPerSecond: number | null
  updatedAt: Date
}

interface Row {
  cpu_percent: string | null
  ram_percent: string | null
  disk_percent: string | null
  disk_io_bytes_per_sec: string | null
  updated_at: Date
}

function toDropletMetrics(row: Row): DropletMetrics {
  return {
    cpuPercent: row.cpu_percent === null ? null : Number(row.cpu_percent),
    ramPercent: row.ram_percent === null ? null : Number(row.ram_percent),
    diskPercent: row.disk_percent === null ? null : Number(row.disk_percent),
    diskIoBytesPerSecond: row.disk_io_bytes_per_sec === null ? null : Number(row.disk_io_bytes_per_sec),
    updatedAt: row.updated_at,
  }
}

/**
 * Calls out to DigitalOcean, computes each figure, and upserts the
 * singleton snapshot row. Never throws — a failed refresh (DO API down,
 * token revoked, network hiccup) leaves the previous snapshot in place
 * rather than taking the footer down; see getDropletMetrics, the only
 * caller, which already tolerates a snapshot that didn't just get fresher.
 */
export async function refreshDropletMetrics(): Promise<void> {
  if (!env.DO_API_TOKEN || !env.DO_DROPLET_ID) return

  try {
    const end = Math.floor(Date.now() / 1000)
    const start = end - 60 * 60

    const [cpuSeries, memoryTotalSeries, memoryAvailableSeries, filesystemFreeSeries, filesystemSizeSeries, diskReadSeries, diskWriteSeries] =
      await Promise.all([
        fetchDoMetric('cpu', start, end),
        fetchDoMetric('memory_total', start, end),
        fetchDoMetric('memory_available', start, end),
        fetchDoMetric('filesystem_free', end - 300, end),
        fetchDoMetric('filesystem_size', end - 300, end),
        fetchDoMetric('disk_read', start, end),
        fetchDoMetric('disk_write', start, end),
      ])

    const cpuPercent = computeCpuPercent(cpuSeries)

    const memoryTotal = averageSeriesValue(memoryTotalSeries)
    const memoryAvailable = averageSeriesValue(memoryAvailableSeries)
    const ramPercent =
      memoryTotal && memoryTotal > 0 && memoryAvailable !== null
        ? Math.max(0, Math.min(100, ((memoryTotal - memoryAvailable) / memoryTotal) * 100))
        : null

    const filesystemFree = latestFilesystemValue(filesystemFreeSeries)
    const filesystemSize = latestFilesystemValue(filesystemSizeSeries)
    const diskPercent =
      filesystemSize && filesystemSize > 0 && filesystemFree !== null
        ? Math.max(0, Math.min(100, ((filesystemSize - filesystemFree) / filesystemSize) * 100))
        : null

    const readRate = seriesRatePerSecond(diskReadSeries)
    const writeRate = seriesRatePerSecond(diskWriteSeries)
    const diskIoBytesPerSecond = readRate === null && writeRate === null ? null : (readRate ?? 0) + (writeRate ?? 0)

    await pool.query(
      `INSERT INTO droplet_metrics (id, cpu_percent, ram_percent, disk_percent, disk_io_bytes_per_sec, updated_at)
       VALUES (true, $1, $2, $3, $4, now())
       ON CONFLICT (id) DO UPDATE
         SET cpu_percent = EXCLUDED.cpu_percent,
             ram_percent = EXCLUDED.ram_percent,
             disk_percent = EXCLUDED.disk_percent,
             disk_io_bytes_per_sec = EXCLUDED.disk_io_bytes_per_sec,
             updated_at = now()`,
      [cpuPercent, ramPercent, diskPercent, diskIoBytesPerSecond],
    )
  } catch (error) {
    console.error('refreshDropletMetrics failed:', error)
  }
}

/** IDEA-028's footer reads this. `null` means either not configured at all
 * (no footer section at all in that case) or a snapshot has never
 * successfully landed yet (first-ever call, or every attempt so far has
 * failed) — the footer treats both the same way, showing nothing rather
 * than a broken-looking zeroed-out box. */
export async function getDropletMetrics(): Promise<DropletMetrics | null> {
  if (!env.DO_API_TOKEN || !env.DO_DROPLET_ID) return null

  const { rows } = await pool.query<Row>('SELECT * FROM droplet_metrics WHERE id = true')
  const row = rows[0]
  const stale = !row || Date.now() - row.updated_at.getTime() > STALE_MS
  if (!stale) return toDropletMetrics(row)

  await refreshDropletMetrics()
  const { rows: refreshed } = await pool.query<Row>('SELECT * FROM droplet_metrics WHERE id = true')
  return refreshed[0] ? toDropletMetrics(refreshed[0]) : null
}
