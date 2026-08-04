import { z } from 'zod'

// Exported so tests can exercise the refinement below (see env.test.ts)
// directly, by parsing sample objects, rather than reloading this module
// with process.env stubbed just to reach a `.parse()` call.
export const envSchema = z
  .object({
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
    // Optional — this app's single root user, identified by GitHub's numeric
    // id (stored as digit-only text elsewhere in this app; see
    // contributors.ts's Row#github_id). Unset means no root user at all.
    // Groundwork for IDEA-011's roles work — nothing consults this yet except
    // isRootUser (lib/root-user.ts).
    // A blank value counts as unset too: both .env.example and the setup guide
    // ship `ROOT_GITHUB_ID=` as the no-op default, and Next's env loader (like
    // `node --env-file`) delivers that line as `''`, not undefined — so the
    // regex below would otherwise reject the documented default at boot.
    ROOT_GITHUB_ID: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().regex(/^\d+$/, 'ROOT_GITHUB_ID must be numeric').optional(),
    ),
  })
  .refine((data) => Boolean(data.LINKEDIN_CLIENT_ID) === Boolean(data.LINKEDIN_CLIENT_SECRET), {
    // Independently optional fields would otherwise let exactly one of the
    // pair be set — passing validation while silently yielding a disabled
    // provider, indistinguishable from deliberately leaving both off. Failing
    // loudly here at boot keeps providers/index.ts's admission check a plain
    // presence test, instead of it having to guess which half-set case means.
    message: 'LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must both be set, or both left unset',
    path: ['LINKEDIN_CLIENT_ID'],
  })

export const env = envSchema.parse(process.env)
