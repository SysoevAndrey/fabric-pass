import { env } from '@/lib/env'
import { discord } from '@/lib/providers/discord'
import { github } from '@/lib/providers/github'
import { linkedin } from '@/lib/providers/linkedin'
import { telegram } from '@/lib/providers/telegram'
import type { Provider, ProviderName } from '@/lib/providers/types'

/**
 * LinkedIn is this app's first optional provider (see lib/env.ts) — its
 * entry is admitted here only when both its credentials are configured, so
 * every caller that looks a provider up by name (`providers[name]`) gets
 * back `undefined` for `'linkedin'` in an environment that hasn't set it up,
 * the same as it would for a name outside `ProviderName` entirely. Every
 * other provider is required and always present.
 */
export const providers: Partial<Record<ProviderName, Provider>> = {
  github,
  discord,
  telegram,
  ...(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET ? { linkedin } : {}),
}

export function isProviderName(value: string): value is ProviderName {
  return value === 'github' || value === 'discord' || value === 'telegram' || value === 'linkedin'
}

/** Whether a known provider name is actually usable right now — distinct
 * from `isProviderName`, which only says the name is one this app knows
 * about at all, configured or not. */
export function isProviderConfigured(name: ProviderName): boolean {
  return name in providers
}
