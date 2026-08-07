import { getDropletMetrics } from '@/lib/droplet-metrics'

type Level = 'green' | 'yellow' | 'red' | 'unknown'

/** IDEA-028's suggested thresholds, not independently reconfirmed — kept
 * as originally proposed (green < 60%, yellow 60–85%, red > 85%). */
function percentLevel(percent: number | null): Level {
  if (percent === null) return 'unknown'
  if (percent < 60) return 'green'
  if (percent <= 85) return 'yellow'
  return 'red'
}

/** Disk I/O has no natural 0-100% denominator the way CPU/RAM/disk usage
 * do (see droplet-metrics.ts's module doc) — these MB/s cutoffs are a
 * rough guess sized for the 1 vCPU/1GB production droplet
 * (cfabric-pass-setup.md), not a confirmed threshold. Worth tuning once
 * real traffic is visible in the footer. */
function ioLevel(bytesPerSecond: number | null): Level {
  if (bytesPerSecond === null) return 'unknown'
  const megabytesPerSecond = bytesPerSecond / (1024 * 1024)
  if (megabytesPerSecond < 5) return 'green'
  if (megabytesPerSecond <= 20) return 'yellow'
  return 'red'
}

function formatPercent(percent: number | null): string {
  return percent === null ? 'unavailable' : `${percent.toFixed(1)}%`
}

function formatRate(bytesPerSecond: number | null): string {
  if (bytesPerSecond === null) return 'unavailable'
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`
}

/**
 * IDEA-028 — Admin-only (gated by the caller, footer.tsx), four
 * independently colored boxes reading IDEA-027's cached snapshot
 * (getDropletMetrics never calls DigitalOcean live from here — see that
 * module's own caching). Renders nothing at all when metrics aren't
 * configured or have never successfully landed, rather than four
 * permanently-grey boxes with nothing behind them.
 */
export async function DropletStatus() {
  const metrics = await getDropletMetrics()
  if (!metrics) return null

  const boxes: { label: string; level: Level; detail: string }[] = [
    { label: 'CPU', level: percentLevel(metrics.cpuPercent), detail: formatPercent(metrics.cpuPercent) },
    { label: 'RAM', level: percentLevel(metrics.ramPercent), detail: formatPercent(metrics.ramPercent) },
    { label: 'Disk', level: percentLevel(metrics.diskPercent), detail: formatPercent(metrics.diskPercent) },
    { label: 'Disk I/O', level: ioLevel(metrics.diskIoBytesPerSecond), detail: formatRate(metrics.diskIoBytesPerSecond) },
  ]

  return (
    <div className="droplet-status">
      {boxes.map((box) => (
        <span
          key={box.label}
          className={`droplet-status-box droplet-status-${box.level}`}
          title={`${box.label}: ${box.detail}`}
        >
          {box.label}
        </span>
      ))}
    </div>
  )
}
