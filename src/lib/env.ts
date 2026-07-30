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
  // in production, before these existed) with no SMTP configured at all —
  // see lib/email.ts, which logs instead of sending when SMTP_HOST is unset.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
})

export const env = schema.parse(process.env)
