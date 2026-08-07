import { expect, test } from 'vitest'
import {
  averageSeriesValue,
  computeCpuPercent,
  getDropletMetrics,
  latestFilesystemValue,
  refreshDropletMetrics,
  seriesRatePerSecond,
} from './droplet-metrics.ts'

function series(mode: string, values: [number, number][]) {
  return { metric: { mode }, values: values.map(([timestamp, value]) => ({ timestamp, value })) }
}

test('computeCpuPercent computes usage from the change in idle vs. total time over the window', () => {
  // 3600s window: total CPU time (all modes) went from 0 to 3600s (1 core,
  // fully sampled); idle went from 0 to 1800s — half the window was idle,
  // so usage should read 50%.
  const cpuSeries = [
    series('idle', [
      [0, 0],
      [3600, 1800],
    ]),
    series('user', [
      [0, 0],
      [3600, 1800],
    ]),
  ]
  expect(computeCpuPercent(cpuSeries)).toBe(50)
})

test('computeCpuPercent reads 0% when idle time grew as fast as total time', () => {
  const cpuSeries = [
    series('idle', [
      [0, 0],
      [3600, 3600],
    ]),
  ]
  expect(computeCpuPercent(cpuSeries)).toBe(0)
})

test('computeCpuPercent returns null when there is no idle series at all', () => {
  const cpuSeries = [series('user', [[0, 0], [3600, 1800]] as [number, number][])]
  expect(computeCpuPercent(cpuSeries)).toBeNull()
})

test('computeCpuPercent returns null with fewer than two samples', () => {
  const cpuSeries = [series('idle', [[0, 0]])]
  expect(computeCpuPercent(cpuSeries)).toBeNull()
})

test('averageSeriesValue averages every sample across every series', () => {
  const memSeries = [series('', [[0, 10], [60, 20], [120, 30]] as [number, number][])]
  expect(averageSeriesValue(memSeries)).toBe(20)
})

test('averageSeriesValue returns null for an empty series', () => {
  expect(averageSeriesValue([])).toBeNull()
})

test('latestFilesystemValue prefers the root mountpoint over other mounted filesystems', () => {
  const fsSeries = [
    { metric: { mountpoint: '/boot' }, values: [{ timestamp: 0, value: 999 }] },
    { metric: { mountpoint: '/' }, values: [{ timestamp: 0, value: 42 }] },
  ]
  expect(latestFilesystemValue(fsSeries)).toBe(42)
})

test('latestFilesystemValue falls back to the first series when nothing is labelled root', () => {
  const fsSeries = [{ metric: {}, values: [{ timestamp: 0, value: 7 }] }]
  expect(latestFilesystemValue(fsSeries)).toBe(7)
})

test('latestFilesystemValue takes the last sample, not the first', () => {
  const fsSeries = [{ metric: { mountpoint: '/' }, values: [{ timestamp: 0, value: 1 }, { timestamp: 60, value: 2 }] }]
  expect(latestFilesystemValue(fsSeries)).toBe(2)
})

test('seriesRatePerSecond computes bytes-per-second from the first and last sample', () => {
  const ioSeries = [series('', [[0, 0], [10, 1000]] as [number, number][])]
  expect(seriesRatePerSecond(ioSeries)).toBe(100)
})

test('seriesRatePerSecond returns null with fewer than two samples', () => {
  expect(seriesRatePerSecond([series('', [[0, 0]] as [number, number][])])).toBeNull()
})

// .env.test deliberately leaves DO_API_TOKEN/DO_DROPLET_ID unset — the same
// optional-and-off-by-default posture RESEND_API_KEY has there — so both
// functions below are exercised in their "not configured" shape against
// the real env module, no mocking needed.
test('getDropletMetrics returns null when DigitalOcean credentials are not configured', async () => {
  expect(await getDropletMetrics()).toBeNull()
})

test('refreshDropletMetrics is a no-op when DigitalOcean credentials are not configured', async () => {
  await expect(refreshDropletMetrics()).resolves.toBeUndefined()
})
