import { afterAll, beforeEach, expect, test, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    teamCalls: [] as [string, string, string][],
    roleCalls: [] as [string, string, string][],
  },
}))

vi.mock('@/lib/github-org', () => ({
  addToGitHubTeam: async (login: string, org: string, team: string) => {
    state.teamCalls.push([login, org, team])
    return true
  },
}))

vi.mock('@/lib/discord-role', () => ({
  grantDiscordRole: async (userId: string, guildId: string, roleId: string) => {
    state.roleCalls.push([userId, guildId, roleId])
    return true
  },
}))

const { syncAppConfig } = await import('./app-config.ts')
const { pool } = await import('./db.ts')
const { grantTrackAccess } = await import('./team-access.ts')

beforeEach(async () => {
  await pool.query('TRUNCATE app_config, track_members, tracks, contributors CASCADE')
  state.teamCalls = []
  state.roleCalls = []
})

afterAll(async () => {
  await pool.end()
})

async function seedTrack(overrides: { githubTeam?: string; discordRoleId?: string } = {}) {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO tracks (slug, name, github_team, discord_role_id) VALUES ('studio', 'Studio', $1, $2) RETURNING id`,
    [overrides.githubTeam ?? null, overrides.discordRoleId ?? null],
  )
  return { id: rows[0].id, slug: 'studio', githubTeam: overrides.githubTeam, discordRoleId: overrides.discordRoleId } as never
}

async function seedContributor(githubId: string, discordId?: string) {
  await pool.query(
    `INSERT INTO contributors (github_id, github_login, name, email, discord_id, status) VALUES ($1, $2, $2, $2 || '@example.com', $3, 'confirmed')`,
    [githubId, `login-${githubId}`, discordId ?? null],
  )
}

function contributor(githubId: string, discordId?: string) {
  return { githubId, githubLogin: `login-${githubId}`, discordId } as never
}

test('does nothing when the track has neither a GitHub team nor a Discord role configured', async () => {
  const track = await seedTrack()
  await seedContributor('1')

  await grantTrackAccess(contributor('1'), track)

  expect(state.teamCalls).toEqual([])
  expect(state.roleCalls).toEqual([])
})

test('adds to the GitHub team and stamps githubTeamAddedAt when the org is configured', async () => {
  const track = await seedTrack({ githubTeam: 'studio-track' })
  await seedContributor('1')
  await pool.query(`INSERT INTO track_members (track_id, github_id, status) VALUES ($1, '1', 'approved')`, [(track as { id: string }).id])
  await syncAppConfig({ githubOrganization: 'constructorfabric' })

  await grantTrackAccess(contributor('1'), track)

  expect(state.teamCalls).toEqual([['login-1', 'constructorfabric', 'studio-track']])
  const { rows } = await pool.query('SELECT github_team_added_at FROM track_members WHERE github_id = $1', ['1'])
  expect(rows[0].github_team_added_at).not.toBeNull()
})

test('does not add to the GitHub team when the track has a team but the org is not configured', async () => {
  const track = await seedTrack({ githubTeam: 'studio-track' })
  await seedContributor('1')
  await pool.query(`INSERT INTO track_members (track_id, github_id, status) VALUES ($1, '1', 'approved')`, [(track as { id: string }).id])

  await grantTrackAccess(contributor('1'), track)

  expect(state.teamCalls).toEqual([])
})

test('grants the Discord role and stamps discordRoleAddedAt when the guild and the contributor discordId are both known', async () => {
  const track = await seedTrack({ discordRoleId: 'role-123' })
  await seedContributor('1', 'discord-user-1')
  await pool.query(`INSERT INTO track_members (track_id, github_id, status) VALUES ($1, '1', 'approved')`, [(track as { id: string }).id])
  await syncAppConfig({ discordGuildId: 'guild-456' })

  await grantTrackAccess(contributor('1', 'discord-user-1'), track)

  expect(state.roleCalls).toEqual([['discord-user-1', 'guild-456', 'role-123']])
  const { rows } = await pool.query('SELECT discord_role_added_at FROM track_members WHERE github_id = $1', ['1'])
  expect(rows[0].discord_role_added_at).not.toBeNull()
})

test('does not grant a Discord role when the contributor has no linked Discord account', async () => {
  const track = await seedTrack({ discordRoleId: 'role-123' })
  await seedContributor('1')
  await pool.query(`INSERT INTO track_members (track_id, github_id, status) VALUES ($1, '1', 'approved')`, [(track as { id: string }).id])
  await syncAppConfig({ discordGuildId: 'guild-456' })

  await grantTrackAccess(contributor('1', undefined), track)

  expect(state.roleCalls).toEqual([])
})
