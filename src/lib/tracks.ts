import { pool } from '@/lib/db'

export interface TrackRepository {
  url: string
  description?: string
  issueTracker?: string
}

/** Leader slots stay named/typed rather than a generic role map — there are
 * always exactly these five, per IDEA-010, not an open-ended list. */
export interface Track {
  id: string
  slug: string
  name: string
  description?: string
  repositories: TrackRepository[]
  productManagerGithubId?: string
  architectGithubId?: string
  developerGithubId?: string
  qualityGithubId?: string
  researcherGithubId?: string
  createdAt: Date
  updatedAt: Date
}

interface TrackRow {
  id: string
  slug: string
  name: string
  description: string | null
  repositories: unknown
  product_manager_github_id: string | null
  architect_github_id: string | null
  developer_github_id: string | null
  quality_github_id: string | null
  researcher_github_id: string | null
  created_at: Date
  updated_at: Date
}

function toTrack(row: TrackRow): Track {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    // jsonb comes back already-parsed from `pg` — cast, not JSON.parse.
    repositories: (row.repositories as TrackRepository[] | null) ?? [],
    productManagerGithubId: row.product_manager_github_id ?? undefined,
    architectGithubId: row.architect_github_id ?? undefined,
    developerGithubId: row.developer_github_id ?? undefined,
    qualityGithubId: row.quality_github_id ?? undefined,
    researcherGithubId: row.researcher_github_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Groundwork for IDEA-007's track directory; nothing renders this yet. */
export async function listTracks(): Promise<Track[]> {
  const { rows } = await pool.query<TrackRow>('SELECT * FROM tracks ORDER BY name')
  return rows.map(toTrack)
}

export interface TrackSync {
  slug: string
  name: string
  description?: string
  repositories: TrackRepository[]
  productManagerGithubLogin?: string
  architectGithubLogin?: string
  developerGithubLogin?: string
  qualityGithubLogin?: string
  researcherGithubLogin?: string
  /** Full replacement each sync, not a diff — matches how the rest of this
   * app treats the registry file as authoritative: whatever it currently
   * lists *is* the whole set. */
  adminGithubLogins: string[]
}

export interface TrackSyncResult {
  synced: string[]
  /** A track whose own upsert, or one of whose leader/admin logins, didn't
   * resolve to a real contributor. Reported rather than aborting every
   * other track's sync. */
  rejected: string[]
}

class UnknownGithubLoginError extends Error {}

/** A login is what the file gives (see tracks-registry.ts's module doc for
 * why); github_id is what every column and FK in this app actually keys
 * on. Throws UnknownGithubLoginError for a login with no matching
 * contributor — the caller decides how loudly that should fail. */
async function resolveGithubId(login: string | undefined): Promise<string | undefined> {
  if (!login) return undefined
  const { rows } = await pool.query<{ github_id: string }>('SELECT github_id FROM contributors WHERE github_login = $1', [
    login,
  ])
  if (rows.length === 0) throw new UnknownGithubLoginError(login)
  return rows[0].github_id
}

/**
 * pass/tracks.yaml -> DB, one-way (see contributors-registry.ts's module
 * doc for why this app's other sync is bidirectional and this one isn't —
 * nothing about a track is self-reported by anyone). Upserts by `slug`,
 * then fully replaces that track's admins to match `adminGithubLogins`
 * exactly — delete-then-insert, not a diff, for the same "the file is the
 * whole set" reason as above.
 */
export async function syncTracks(tracks: TrackSync[]): Promise<TrackSyncResult> {
  const synced: string[] = []
  const rejected: string[] = []

  for (const track of tracks) {
    let leaderIds: {
      productManager?: string
      architect?: string
      developer?: string
      quality?: string
      researcher?: string
    }
    try {
      leaderIds = {
        productManager: await resolveGithubId(track.productManagerGithubLogin),
        architect: await resolveGithubId(track.architectGithubLogin),
        developer: await resolveGithubId(track.developerGithubLogin),
        quality: await resolveGithubId(track.qualityGithubLogin),
        researcher: await resolveGithubId(track.researcherGithubLogin),
      }
    } catch (error) {
      if (error instanceof UnknownGithubLoginError) {
        rejected.push(track.slug)
        continue
      }
      throw error
    }

    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO tracks (slug, name, description, repositories, product_manager_github_id, architect_github_id, developer_github_id, quality_github_id, researcher_github_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             repositories = EXCLUDED.repositories,
             product_manager_github_id = EXCLUDED.product_manager_github_id,
             architect_github_id = EXCLUDED.architect_github_id,
             developer_github_id = EXCLUDED.developer_github_id,
             quality_github_id = EXCLUDED.quality_github_id,
             researcher_github_id = EXCLUDED.researcher_github_id,
             updated_at = now()
       RETURNING id`,
      [
        track.slug,
        track.name,
        track.description ?? null,
        JSON.stringify(track.repositories),
        leaderIds.productManager ?? null,
        leaderIds.architect ?? null,
        leaderIds.developer ?? null,
        leaderIds.quality ?? null,
        leaderIds.researcher ?? null,
      ],
    )
    const trackId = rows[0].id

    await pool.query('DELETE FROM track_admins WHERE track_id = $1', [trackId])
    let adminsRejected = false
    for (const login of track.adminGithubLogins) {
      try {
        const githubId = await resolveGithubId(login)
        await pool.query('INSERT INTO track_admins (track_id, github_id) VALUES ($1, $2)', [trackId, githubId])
      } catch (error) {
        if (error instanceof UnknownGithubLoginError) {
          adminsRejected = true
          continue
        }
        throw error
      }
    }

    if (adminsRejected) rejected.push(track.slug)
    else synced.push(track.slug)
  }

  return { synced, rejected }
}
