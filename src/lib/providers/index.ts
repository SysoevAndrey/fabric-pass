import { discord } from '@/lib/providers/discord'
import { github } from '@/lib/providers/github'
import { telegram } from '@/lib/providers/telegram'
import type { Provider, ProviderName } from '@/lib/providers/types'

export const providers: Record<ProviderName, Provider> = { github, discord, telegram }

export function isProviderName(value: string): value is ProviderName {
  return value === 'github' || value === 'discord' || value === 'telegram'
}
