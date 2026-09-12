import { expect, it } from 'vitest'
import { comparisonSource } from '../fixtures/comparison-source.js'
import { resolveComparisonSource } from '../../scripts/release/comparison-source.js'

it('resolves the exact successful fixture build and immutable artifact ID', () => {
  const value = comparisonSource()
  expect(resolveComparisonSource(value.expected, value.api)).toMatchObject({
    kind: 'qualification-fixture',
    workflow: { runId: 10, attempt: 1 },
    artifact: { id: 20 }
  })
  expect(value.calls).not.toContain(expect.stringContaining('latest'))
})
it.each([
  'status',
  'conclusion',
  'path',
  'head_branch',
  'event',
  'head_sha'
] as const)('rejects a wrong fixture run %s', (field) => {
  const value = comparisonSource()
  value.run[field] = 'wrong'
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow()
})
it('rejects a rerun and foreign repository', () => {
  const value = comparisonSource()
  value.run.run_attempt = 2
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow(
    /workflow identity/
  )
  value.run.run_attempt = 1
  value.run.head_repository.full_name = 'someone/fork'
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow()
})
it('rejects an expired or replaced fixture artifact', () => {
  const value = comparisonSource()
  value.metadata.expired = true
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow()
  value.metadata.expired = false
  value.metadata.workflow_run.id = 999
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow(
    /another build/
  )
})
it('rejects duplicate artifact names and missing list membership', () => {
  const value = comparisonSource()
  value.listing.artifacts.push({ id: 21, name: value.metadata.name })
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow(
    /ambiguous/
  )
  value.listing.artifacts = []
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow(
    /absent/
  )
})
it('resolves a published tag and an annotated tag to the requested commit', () => {
  const value = comparisonSource('published-release')
  expect(resolveComparisonSource(value.expected, value.api)).toMatchObject({
    kind: 'published-release',
    releaseId: 30,
    commit: value.expected.manifest.commit
  })
  value.ref.object = { type: 'tag', sha: 'f'.repeat(40) }
  expect(resolveComparisonSource(value.expected, value.api)).toMatchObject({
    commit: value.expected.manifest.commit
  })
})
it('rejects document-only releases, drafts and prereleases', () => {
  const value = comparisonSource('published-release')
  value.release.draft = true
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow()
  value.release.draft = false
  value.release.prerelease = true
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow()
  value.release.prerelease = false
  value.release.assets = []
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow(
    /exactly one/
  )
})
it('rejects duplicate assets, mismatched size and a moved tag', () => {
  const value = comparisonSource('published-release')
  value.release.assets.push(value.release.assets[0]!)
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow(
    /exactly one/
  )
  value.release.assets.pop()
  value.release.assets[1]!.size++
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow(
    /sizes/
  )
  value.release.assets[1]!.size--
  value.ref.object.sha = 'b'.repeat(40)
  expect(() => resolveComparisonSource(value.expected, value.api)).toThrow(
    /source commit/
  )
})
it.each([403, 404, 500])('does not fall back after HTTP %s', (status) => {
  const value = comparisonSource()
  expect(() =>
    resolveComparisonSource(value.expected, () => ({ status, body: {} }))
  ).toThrow(/unavailable/)
})
