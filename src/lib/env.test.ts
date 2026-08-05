import { expect, test } from 'vitest'
import { envSchema } from './env.ts'

// A minimal object satisfying every required field, so each test below only
// has to vary the LinkedIn pair or ROOT_GITHUB_ID it's actually checking.
const baseEnv = {
  DATABASE_URL: 'postgresql://localhost:5432/test',
  SESSION_PASSWORD: 'test-password-at-least-32-characters-long',
  APP_URL: 'http://localhost:3000',
  GITHUB_CLIENT_ID: 'github-id',
  GITHUB_CLIENT_SECRET: 'github-secret',
  DISCORD_CLIENT_ID: 'discord-id',
  DISCORD_CLIENT_SECRET: 'discord-secret',
  TELEGRAM_CLIENT_ID: 'telegram-id',
  TELEGRAM_CLIENT_SECRET: 'telegram-secret',
  CONTRIBUTORS_EXPORT_SECRET: 'export-secret',
  CONTRIBUTORS_SYNC_SECRET: 'sync-secret',
  TRACKS_SYNC_SECRET: 'tracks-sync-secret',
}

test('parses with both LinkedIn credentials unset', () => {
  expect(() => envSchema.parse(baseEnv)).not.toThrow()
})

test('parses with both LinkedIn credentials set', () => {
  expect(() =>
    envSchema.parse({ ...baseEnv, LINKEDIN_CLIENT_ID: 'linkedin-id', LINKEDIN_CLIENT_SECRET: 'linkedin-secret' }),
  ).not.toThrow()
})

test('rejects LINKEDIN_CLIENT_ID set without LINKEDIN_CLIENT_SECRET', () => {
  expect(() => envSchema.parse({ ...baseEnv, LINKEDIN_CLIENT_ID: 'linkedin-id' })).toThrow()
})

test('rejects LINKEDIN_CLIENT_SECRET set without LINKEDIN_CLIENT_ID', () => {
  expect(() => envSchema.parse({ ...baseEnv, LINKEDIN_CLIENT_SECRET: 'linkedin-secret' })).toThrow()
})

test('parses with ROOT_GITHUB_ID unset', () => {
  expect(() => envSchema.parse(baseEnv)).not.toThrow()
})

test('parses with a numeric ROOT_GITHUB_ID', () => {
  expect(() => envSchema.parse({ ...baseEnv, ROOT_GITHUB_ID: '12345' })).not.toThrow()
})

test('rejects a non-numeric ROOT_GITHUB_ID', () => {
  expect(() => envSchema.parse({ ...baseEnv, ROOT_GITHUB_ID: 'not-a-number' })).toThrow()
})

test('treats a blank ROOT_GITHUB_ID as unset', () => {
  const result = envSchema.parse({ ...baseEnv, ROOT_GITHUB_ID: '' })
  expect(result.ROOT_GITHUB_ID).toBeUndefined()
})
