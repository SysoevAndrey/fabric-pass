import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_PASSWORD: z.string().min(32, 'SESSION_PASSWORD must be at least 32 characters'),
  APP_URL: z.url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  TELEGRAM_CLIENT_ID: z.string().min(1),
  TELEGRAM_CLIENT_SECRET: z.string().min(1),
  CONTRIBUTORS_EXPORT_SECRET: z.string().min(1),
  CONTRIBUTORS_SYNC_SECRET: z.string().min(1),
  // Optional, unlike everything above: this app must still boot (and did,
  // in production, before these existed) with no Resend key configured at
  // all — see lib/email.ts, which logs instead of sending when unset.
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_ADDRESS: z.string().min(1).optional(),
  // Optional for the same reason: staged ahead of the LinkedIn provider
  // integration itself (IDEA-024, github.com/constructorfabric/fabric-pass/issues/7),
  // which doesn't exist in this app yet — nothing reads these two yet.
  LINKEDIN_CLIENT_ID: z.string().min(1).optional(),
  LINKEDIN_CLIENT_SECRET: z.string().min(1).optional(),
})

export const env = schema.parse(process.env)
