import { beforeEach, expect, test, vi } from 'vitest'

// Reproduces the live-walkthrough defect: starting a second provider's OAuth
// flow before finishing the first must not destroy the first's PKCE
// transaction. This test drives both route handlers — the authorization
// start route and the callback route — against one shared in-memory session,
// the same seam the existing github-guard test uses for the callback alone.
const { fakeSession, authRequestResult, callbackResult } = vi.hoisted(() => ({
  fakeSession: {
    oauth: undefined as
      | Partial<
          Record<'github' | 'discord' | 'telegram', { codeVerifier: string; state: string; variant?: 'phone' }>
        >
      | undefined,
    github: undefined as { id: string; login: string } | undefined,
    pending: undefined as { telegram?: unknown; discord?: unknown } | undefined,
    save: async () => {},
  },
  // Each provider gets a distinguishable codeVerifier/state pair, so a test
  // can tell whether the callback received *its own* provider's pair or one
  // clobbered by a different provider's start.
  authRequestResult: {
    discord: { url: new URL('https://discord.com/oauth2/authorize?mock=1'), codeVerifier: 'discord-verifier', state: 'discord-state' },
    telegram: { url: new URL('https://oauth.telegram.org/auth?mock=1'), codeVerifier: 'telegram-verifier', state: 'telegram-state' },
  },
  callbackResult: {
    discord: { providerId: 'discord-id-1', username: 'discordfan' },
  },
}))

vi.mock('@/lib/session', () => ({
  getSession: async () => fakeSession,
}))

vi.mock('@/lib/providers', () => ({
  isProviderName: (value: string) => value === 'github' || value === 'discord' || value === 'telegram',
  providers: {
    github: {
      name: 'github',
      authRequest: async () => {
        throw new Error('not used in this test')
      },
      callback: async () => {
        throw new Error('not used in this test')
      },
    },
    discord: {
      name: 'discord',
      authRequest: async (_redirectUri: string) => authRequestResult.discord,
      callback: async () => callbackResult.discord,
    },
    telegram: {
      name: 'telegram',
      authRequest: async (_redirectUri: string) => authRequestResult.telegram,
      callback: async () => {
        throw new Error('not used in this test — only discord is completed here')
      },
    },
  },
}))

const { GET: startGET } = await import('@/app/auth/[provider]/route')
const { GET: callbackGET } = await import('@/app/auth/[provider]/callback/route')

beforeEach(() => {
  fakeSession.oauth = undefined
  fakeSession.github = undefined
  fakeSession.pending = undefined
})

test('starting provider B while provider A is still in flight lets A still complete', async () => {
  // Start Discord's flow first — the transaction from the live walkthrough
  // log that got clobbered.
  await startGET(new Request('http://localhost:3000/auth/discord'), {
    params: Promise.resolve({ provider: 'discord' }),
  })

  // Start Telegram's flow before Discord's callback ever lands — this is the
  // "alternating GET /auth/telegram and GET /auth/discord starts" from the
  // walkthrough log.
  await startGET(new Request('http://localhost:3000/auth/telegram'), {
    params: Promise.resolve({ provider: 'telegram' }),
  })

  // Now complete Discord's callback. On the old single-slot session this
  // transaction was already overwritten by Telegram's start, so the guard
  // rejected it as expired in 5ms — no token exchange attempted.
  const response = await callbackGET(
    new Request('http://localhost:3000/auth/discord/callback?code=abc&state=discord-state'),
    { params: Promise.resolve({ provider: 'discord' }) },
  )

  const location = response.headers.get('location')
  expect(location).not.toContain('notice=expired')
  expect(fakeSession.pending).toEqual({ discord: { providerId: 'discord-id-1', username: 'discordfan' } })

  // Telegram's still in-flight transaction must have survived Discord's
  // callback consuming its own slot.
  expect(fakeSession.oauth?.telegram).toEqual({ codeVerifier: 'telegram-verifier', state: 'telegram-state' })
  expect(fakeSession.oauth?.discord).toBeUndefined()
})

test('a callback naming a provider with no transaction at all is still refused as expired', async () => {
  // Nothing has been started for github in this session.
  const response = await callbackGET(
    new Request('http://localhost:3000/auth/github/callback?code=abc&state=whatever'),
    { params: Promise.resolve({ provider: 'github' }) },
  )

  const location = response.headers.get('location')
  expect(location).toContain('notice=expired')
  expect(fakeSession.github).toBeUndefined()
  expect(fakeSession.pending).toBeUndefined()
})
