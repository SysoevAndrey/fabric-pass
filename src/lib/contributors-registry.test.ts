import { expect, test } from 'vitest'
import { parseRegistryYaml, toRegistryYaml } from './contributors-registry.ts'
import type { Contributor } from './contributors.ts'

function contributor(overrides: Partial<Contributor> = {}): Contributor {
  return {
    id: 'id-1',
    githubId: '1001',
    githubLogin: 'octocat',
    status: 'draft',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

test('renders a contributor as a registry row, contact fields and status alike', () => {
  const yaml = toRegistryYaml([
    contributor({ name: 'Ada Lovelace', email: 'ada@example.com', company: 'Analytical Engines', status: 'confirmed' }),
  ])

  expect(yaml).toContain('github_id: "1001"')
  expect(yaml).toContain('github_login: octocat')
  expect(yaml).toContain('name: Ada Lovelace')
  expect(yaml).toContain('email: ada@example.com')
  expect(yaml).toContain('company: Analytical Engines')
  expect(yaml).toContain('status: confirmed')
})

test('an unset contact field renders as null, not omitted or empty-string', () => {
  const yaml = toRegistryYaml([contributor()])
  expect(yaml).toContain('name: null')
  expect(yaml).toContain('email: null')
})

test('round-trips status updates back out of what it just rendered', () => {
  const yaml = toRegistryYaml([
    contributor({ githubId: '1001', status: 'confirmed' }),
    contributor({ githubId: '2002', status: 'draft' }),
  ])

  const { updates, invalidRowCount } = parseRegistryYaml(yaml)

  expect(invalidRowCount).toBe(0)
  expect(updates).toEqual([
    { githubId: '1001', status: 'confirmed' },
    { githubId: '2002', status: 'draft' },
  ])
})

test('accepts a bare YAML integer github_id, the same as a quoted one', () => {
  const { updates } = parseRegistryYaml('contributors:\n  - github_id: 1001\n    status: confirmed\n')
  expect(updates).toEqual([{ githubId: '1001', status: 'confirmed' }])
})

test('drops a row with an out-of-set status rather than throwing', () => {
  const { updates, invalidRowCount } = parseRegistryYaml(
    'contributors:\n  - github_id: "1001"\n    status: banned\n  - github_id: "2002"\n    status: confirmed\n',
  )
  expect(invalidRowCount).toBe(1)
  expect(updates).toEqual([{ githubId: '2002', status: 'confirmed' }])
})

test('drops a row missing github_id entirely', () => {
  const { updates, invalidRowCount } = parseRegistryYaml('contributors:\n  - status: confirmed\n')
  expect(invalidRowCount).toBe(1)
  expect(updates).toEqual([])
})

test('an empty or missing contributors list parses to no updates, not an error', () => {
  expect(parseRegistryYaml('contributors: []\n')).toEqual({ updates: [], invalidRowCount: 0 })
  expect(parseRegistryYaml('{}\n')).toEqual({ updates: [], invalidRowCount: 0 })
})
