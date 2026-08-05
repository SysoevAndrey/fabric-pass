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
  productManagerGithubId?: string
  architectGithubId?: string
  developerGithubId?: string
  qualityGithubId?: string
  researcherGithubId?: string
  /** Full replacement each sync, not a diff — matches how the rest of this
   * app treats the registry file as authoritative: whatever it currently
   * lists *is* the whole set. */
  adminGithubIds: string[]
}

export interface TrackSyncResult {
  synced: string[]
  /** A track whose own upsert, or one of whose leader/admin github_ids,
   * failed the database's FK constraint — an unknown contributor. Reported
   * rather than aborting every other track's sync. */
  rejected: string[]
}

/**
 * pass/tracks.yaml -> DB, one-way (see contributors-registry.ts's module
 * doc for why this app's other sync is bidirectional and this one isn't —
 * nothing about a track is self-reported by anyone). Upserts by `slug`,
 * then fully replaces that track's admins to match `adminGithubIds` exactly
 * — delete-then-insert, not a diff, for the same "the file is the whole
 * set" reason as above.
 */
export async function syncTracks(tracks: TrackSync[]): Promise<TrackSyncResult> {
  const synced: string[] = []
  const rejected: string[] = []

  for (const track of tracks) {
    let trackId: string
    try {
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
          track.productManagerGithubId ?? null,
          track.architectGithubId ?? null,
          track.developerGithubId ?? null,
          track.qualityGithubId ?? null,
          track.researcherGithubId ?? null,
        ],
      )
      trackId = rows[0].id
    } catch (error) {
      const violation = error as { code?: string }
      if (violation.code === '23503') {
        rejected.push(track.slug)
        continue
      }
      throw error
    }

    await pool.query('DELETE FROM track_admins WHERE track_id = $1', [trackId])
    let adminsRejected = false
    for (const githubId of track.adminGithubIds) {
      try {
        await pool.query('INSERT INTO track_admins (track_id, github_id) VALUES ($1, $2)', [trackId, githubId])
      } catch (error) {
        const violation = error as { code?: string }
        if (violation.code === '23503') {
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
