import { parse } from 'yaml'
import { z } from 'zod'
import type { TrackSync } from '@/lib/tracks'

const repositorySchema = z.object({
  url: z.string().min(1),
  description: z.string().min(1).optional(),
  issue_tracker: z.string().min(1).optional(),
})

// A GitHub login, not a github_id — logins are what a human hand-editing
// this file actually knows and can eyeball-verify, unlike an opaque numeric
// id. syncTracks resolves each one to the matching contributor's github_id
// at sync time (a login isn't stable enough to store as the real key —
// GitHub accounts can rename — so github_id stays the identity everywhere
// else in this app; only this file's human-facing format changes).
const leaderLogin = z.string().min(1).nullish()

const trackRowSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  repositories: z.array(repositorySchema).default([]),
  leaders: z
    .object({
      product_manager: leaderLogin,
      architect: leaderLogin,
      developer: leaderLogin,
      quality: leaderLogin,
      researcher: leaderLogin,
    })
    .default({}),
  admins: z.array(z.string().min(1)).default([]),
})

const registryFileSchema = z.object({
  tracks: z.array(z.unknown()).default([]),
})

/**
 * pass/tracks.yaml -> TrackSync[]. A row failing validation (missing slug
 * or name) is dropped, not thrown on — same reasoning as
 * contributors-registry.ts's parseRegistryYaml: one malformed hand-edit
 * shouldn't block every other track from syncing. Login -> github_id
 * resolution happens later, in tracks.ts's syncTracks — this function has
 * no database connection to validate against.
 */
export function parseTracksYaml(content: string): { tracks: TrackSync[]; invalidRowCount: number } {
  const parsed = registryFileSchema.parse(parse(content) ?? {})
  const tracks: TrackSync[] = []
  let invalidRowCount = 0

  for (const raw of parsed.tracks) {
    const row = trackRowSchema.safeParse(raw)
    if (!row.success) {
      invalidRowCount += 1
      continue
    }
    tracks.push({
      slug: row.data.slug,
      name: row.data.name,
      description: row.data.description,
      repositories: row.data.repositories.map((repo) => ({
        url: repo.url,
        description: repo.description,
        issueTracker: repo.issue_tracker,
      })),
      productManagerGithubLogin: row.data.leaders.product_manager ?? undefined,
      architectGithubLogin: row.data.leaders.architect ?? undefined,
      developerGithubLogin: row.data.leaders.developer ?? undefined,
      qualityGithubLogin: row.data.leaders.quality ?? undefined,
      researcherGithubLogin: row.data.leaders.researcher ?? undefined,
      adminGithubLogins: row.data.admins,
    })
  }

  return { tracks, invalidRowCount }
}
