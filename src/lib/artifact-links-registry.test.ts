import { expect, test } from 'vitest'
import { parseArtifactLinksYaml } from './artifact-links-registry.ts'

test('parses a full artifact link row', () => {
  const { links, invalidRowCount } = parseArtifactLinksYaml(`
artifact_links:
  - scope: community
    category: policy
    label: Code of Conduct
    url: https://github.com/constructorfabric/governance/blob/main/CODE_OF_CONDUCT.md
`)

  expect(invalidRowCount).toBe(0)
  expect(links).toEqual([
    {
      scope: 'community',
      category: 'policy',
      label: 'Code of Conduct',
      url: 'https://github.com/constructorfabric/governance/blob/main/CODE_OF_CONDUCT.md',
    },
  ])
})

test('drops a row missing scope, category, label, or url rather than throwing', () => {
  const { links, invalidRowCount } = parseArtifactLinksYaml(`
artifact_links:
  - category: policy
    label: No scope here
    url: https://example.com/1
  - scope: community
    label: No category here
    url: https://example.com/2
  - scope: community
    category: policy
    url: https://example.com/3
  - scope: community
    category: policy
    label: No url here
  - scope: community
    category: policy
    label: Valid row
    url: https://example.com/5
`)

  expect(invalidRowCount).toBe(4)
  expect(links).toEqual([
    { scope: 'community', category: 'policy', label: 'Valid row', url: 'https://example.com/5' },
  ])
})

test('drops a row whose category is outside the known set', () => {
  const { links, invalidRowCount } = parseArtifactLinksYaml(
    'artifact_links:\n  - scope: community\n    category: not-a-real-category\n    label: Bad category\n    url: https://example.com\n',
  )
  expect(invalidRowCount).toBe(1)
  expect(links).toEqual([])
})

test('an empty or missing artifact_links list parses to no links, not an error', () => {
  expect(parseArtifactLinksYaml('artifact_links: []\n')).toEqual({ links: [], invalidRowCount: 0 })
  expect(parseArtifactLinksYaml('{}\n')).toEqual({ links: [], invalidRowCount: 0 })
})
