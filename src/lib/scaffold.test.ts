import { expect, test } from 'vitest'

test('the toolchain runs TypeScript tests', () => {
  const version: string = process.version
  expect(version.startsWith('v24.')).toBe(true)
})
