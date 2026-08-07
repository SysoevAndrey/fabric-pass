import { notFound } from 'next/navigation'
import { listArtifactLinks } from '@/lib/artifact-links'
import { findByGithubId, type Contributor } from '@/lib/contributors'
import { getSession } from '@/lib/session'
import { findTrackBySlug, type Track } from '@/lib/tracks'
import { getTrackPageTemplate, renderTrackPage, type TrackPageLeader } from '@/lib/track-page-template'
import { SignInPrompt } from '@/app/sign-in-prompt'

interface PageProps {
  params: Promise<{ slug: string }>
}

const LEADER_SLOTS: { field: keyof Track; role: string }[] = [
  { field: 'productManagerGithubId', role: 'Product Manager' },
  { field: 'architectGithubId', role: 'Architect' },
  { field: 'developerGithubId', role: 'Developer' },
  { field: 'qualityGithubId', role: 'Quality' },
  { field: 'researcherGithubId', role: 'Researcher' },
]

/** Each filled leader slot's display label — the contributor's name,
 * falling back to their GitHub login (same fallback the Admin tiles use).
 * A slot whose github_id no longer resolves to a contributor row is
 * silently skipped rather than shown broken — shouldn't happen (tracks.ts's
 * syncTracks only ever writes a resolved id), but a row deleted out from
 * under a track since the last sync is exactly the kind of thing worth not
 * crashing the page over. */
async function resolveLeaders(track: Track): Promise<TrackPageLeader[]> {
  const leaders: TrackPageLeader[] = []
  for (const { field, role } of LEADER_SLOTS) {
    const githubId = track[field]
    if (typeof githubId !== 'string') continue
    const contributor: Contributor | null = await findByGithubId(githubId)
    if (!contributor) continue
    leaders.push({ role, name: contributor.name ?? `@${contributor.githubLogin}` })
  }
  return leaders
}

/**
 * IDEA-035 — the detail half of the track directory/track page split (see
 * IDEA-007's directory, which links here). Rendered from cf-internal's one
 * shared markdown template (pass/track-page.md) with this track's own data
 * substituted in — see track-page-template.ts for exactly how.
 */
export default async function TrackPage({ params }: PageProps) {
  const session = await getSession()
  if (!session.github) return <SignInPrompt />

  const contributor = await findByGithubId(session.github.id)
  if (!contributor) return <SignInPrompt />

  const { slug } = await params
  const track = await findTrackBySlug(slug)
  if (!track) notFound()

  const [leaders, artifactLinks, template] = await Promise.all([
    resolveLeaders(track),
    listArtifactLinks(track.slug),
    getTrackPageTemplate(),
  ])

  if (!template) {
    return (
      <>
        <h2>{track.name}</h2>
        <p className="subtitle">
          This track's page hasn't been set up yet — cf-internal's <code>pass/track-page.md</code> hasn't synced.
        </p>
      </>
    )
  }

  const html = renderTrackPage(template, {
    name: track.name,
    description: track.description,
    leaders,
    repositories: track.repositories,
    artifactLinks,
  })

  return (
    <>
      {/* Trusted content, not user input — the template and every value
          substituted into it come from cf-internal, admin-edited the same
          way pass/tracks.yaml already is (see track-page-template.ts's
          module doc). */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  )
}
