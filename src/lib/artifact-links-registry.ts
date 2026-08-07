import { parse } from 'yaml'
import { z } from 'zod'
import { ARTIFACT_LINK_CATEGORIES, type ArtifactLinkSync } from '@/lib/artifact-links'

const artifactLinkRowSchema = z.object({
  scope: z.string().min(1),
  category: z.enum(ARTIFACT_LINK_CATEGORIES),
  label: z.string().min(1),
  url: z.string().min(1),
})

const registryFileSchema = z.object({
  artifact_links: z.array(z.unknown()).default([]),
})

/**
 * pass/artifact-links.yaml -> ArtifactLinkSync[]. A row failing validation
 * (missing scope/label/url, or a category outside ARTIFACT_LINK_CATEGORIES)
 * is dropped, not thrown on — same reasoning as tracks-registry.ts's
 * parseTracksYaml: one malformed hand-edit shouldn't block every other
 * link from syncing. Whether `scope` actually names a real track (or
 * `COMMUNITY_SCOPE`) is checked later, in artifact-links.ts's
 * syncArtifactLinks — this function has no database connection to
 * validate against.
 */
export function parseArtifactLinksYaml(content: string): { links: ArtifactLinkSync[]; invalidRowCount: number } {
  const parsed = registryFileSchema.parse(parse(content) ?? {})
  const links: ArtifactLinkSync[] = []
  let invalidRowCount = 0

  for (const raw of parsed.artifact_links) {
    const row = artifactLinkRowSchema.safeParse(raw)
    if (!row.success) {
      invalidRowCount += 1
      continue
    }
    links.push({
      scope: row.data.scope,
      category: row.data.category,
      label: row.data.label,
      url: row.data.url,
    })
  }

  return { links, invalidRowCount }
}
