import { parse } from 'yaml'
import { z } from 'zod'
import type { TrackSync } from '@/lib/tracks'

const repositorySchema = z.object({
  url: z.string().min(1),
  description: z.string().min(1).optional(),
  issue_tracker: z.string().min(1).optional(),
})

// Leader github_ids accept a bare YAML integer too, same reasoning as
// contributors-registry.ts's github_id: an admin hand-editing the file
// isn't guaranteed to keep this app's own quoting.
const leaderId = z.union([z.string(), z.number()]).transform(String).nullish()

const trackRowSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  repositories: z.array(repositorySchema).default([]),
  leaders: z
    .object({
      product_manager: leaderId,
      architect: leaderId,
      developer: leaderId,
      quality: leaderId,
      researcher: leaderId,
    })
    .default({}),
  admins: z.array(z.union([z.string(), z.number()]).transform(String)).default([]),
})

const registryFileSchema = z.object({
  tracks: z.array(z.unknown()).default([]),
})

/**
 * pass/tracks.yaml -> TrackSync[]. A row failing validation (missing slug
 * or name) is dropped, not thrown on — same reasoning as
 * contributors-registry.ts's parseRegistryYaml: one malformed hand-edit
 * shouldn't block every other track from syncing.
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
      productManagerGithubId: row.data.leaders.product_manager ?? undefined,
      architectGithubId: row.data.leaders.architect ?? undefined,
      developerGithubId: row.data.leaders.developer ?? undefined,
      qualityGithubId: row.data.leaders.quality ?? undefined,
      researcherGithubId: row.data.leaders.researcher ?? undefined,
      adminGithubIds: row.data.admins,
    })
  }

  return { tracks, invalidRowCount }
}
