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
  // This app's only optional *provider* — unlike GitHub/Discord/Telegram
  // above, LinkedIn must be possible to leave unconfigured and still have
  // the app boot and run. See lib/providers/index.ts, which admits
  // 'linkedin' into its providers map only when both of these are set, and
  // form.tsx, which hides the LinkedIn row unless the page resolved a
  // provider for it.
  LINKEDIN_CLIENT_ID: z.string().min(1).optional(),
  LINKEDIN_CLIENT_SECRET: z.string().min(1).optional(),
})

export const env = schema.parse(process.env)
