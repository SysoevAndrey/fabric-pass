import { afterAll, beforeEach, expect, test } from 'vitest'
import { pool } from './db.ts'
import { listTracks, syncTracks, type TrackSync } from './tracks.ts'

function trackSync(overrides: Partial<TrackSync> & { slug: string; name: string }): TrackSync {
  return { repositories: [], adminGithubIds: [], ...overrides }
}

beforeEach(async () => {
  // CASCADE: track_admins FK-references tracks; contributors is truncated
  // too since every leader/admin github_id below is a real FK into it.
  await pool.query('TRUNCATE tracks, contributors CASCADE')
})

afterAll(async () => {
  await pool.end()
})

test('syncs a new track by slug', async () => {
  const { synced, rejected } = await syncTracks([
    trackSync({ slug: 'studio', name: 'Constructor Studio', description: 'Structure and process organizer.' }),
  ])

  expect(synced).toEqual(['studio'])
  expect(rejected).toEqual([])

  const [track] = await listTracks()
  expect(track.slug).toBe('studio')
  expect(track.name).toBe('Constructor Studio')
  expect(track.description).toBe('Structure and process organizer.')
})

test('re-syncing the same slug updates the existing row rather than adding a second one', async () => {
  await syncTracks([trackSync({ slug: 'studio', name: 'Constructor Studio' })])
  await syncTracks([trackSync({ slug: 'studio', name: 'Constructor Studio (renamed)' })])

  const tracks = await listTracks()
  expect(tracks).toHaveLength(1)
  expect(tracks[0].name).toBe('Constructor Studio (renamed)')
})

test('stores repositories as given', async () => {
  await syncTracks([
    trackSync({
      slug: 'studio',
      name: 'Constructor Studio',
      repositories: [
        { url: 'https://github.com/constructorfabric/studio', description: 'The thing itself', issueTracker: 'https://github.com/constructorfabric/studio/issues' },
      ],
    }),
  ])

  const [track] = await listTracks()
  expect(track.repositories).toEqual([
    { url: 'https://github.com/constructorfabric/studio', description: 'The thing itself', issueTracker: 'https://github.com/constructorfabric/studio/issues' },
  ])
})

test('assigns leader slots to a real contributor', async () => {
  await pool.query("INSERT INTO contributors (github_id, github_login) VALUES (1001, 'octocat')")

  await syncTracks([trackSync({ slug: 'studio', name: 'Constructor Studio', productManagerGithubId: '1001' })])

  const [track] = await listTracks()
  expect(track.productManagerGithubId).toBe('1001')
})

test('rejects a track whose leader github_id is not a real contributor, without touching any other track', async () => {
  const { synced, rejected } = await syncTracks([
    trackSync({ slug: 'studio', name: 'Constructor Studio', productManagerGithubId: '999999' }),
    trackSync({ slug: 'insight', name: 'Constructor Insight' }),
  ])

  expect(rejected).toEqual(['studio'])
  expect(synced).toEqual(['insight'])
  expect(await listTracks()).toHaveLength(1)
})

test('assigns and fully replaces a track admins set on every sync', async () => {
  await pool.query("INSERT INTO contributors (github_id, github_login) VALUES (1001, 'octocat'), (2002, 'grace')")

  await syncTracks([trackSync({ slug: 'studio', name: 'Constructor Studio', adminGithubIds: ['1001'] })])
  let { rows } = await pool.query('SELECT github_id::text FROM track_admins')
  expect(rows.map((r) => r.github_id)).toEqual(['1001'])

  await syncTracks([trackSync({ slug: 'studio', name: 'Constructor Studio', adminGithubIds: ['2002'] })])
  ;({ rows } = await pool.query('SELECT github_id::text FROM track_admins'))
  expect(rows.map((r) => r.github_id)).toEqual(['2002'])
})

test('rejects a track whose admin github_id is not a real contributor', async () => {
  const { rejected } = await syncTracks([trackSync({ slug: 'studio', name: 'Constructor Studio', adminGithubIds: ['999999'] })])

  expect(rejected).toEqual(['studio'])
  // The track itself still synced — only the admin assignment failed.
  expect(await listTracks()).toHaveLength(1)
})
